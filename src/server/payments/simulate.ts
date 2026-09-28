import { isMockMode } from "@/server/env";
import type { Deps } from "@/server/env";
import { getDonationStatus, getDonationBySession } from "@/server/donations/queries";
import { handleWebhookRequest } from "@/server/donations/handle-payment-event";
import { buildMockWebhookRequest } from "@/server/payments/mock";
import { getPaymentProvider } from "@/server/payments";

export type SimulatedPaymentResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "not_found" | "simulate_failed" };

/**
 * Applies a simulated mock-checkout outcome to the donation behind
 * `sessionId`, in-process (never over `fetch` — Workers can't call back into
 * themselves). Builds a signed mock webhook request with
 * `buildMockWebhookRequest` and hands it straight to `handleWebhookRequest`,
 * the same path a real provider's webhook takes, so the flow stays
 * idempotent and exercises the real alert-publishing code.
 *
 * Every failure mode comes back as a typed `{ ok: false, error }` result
 * instead of `null`/thrown errors, so this whole function is the testable
 * "pure core" behind the `simulatePayment` server action — the action is a
 * thin `getDeps()` wrapper around it and never needs its own `notFound()`
 * control-flow throw (which a client component calling a server action
 * can't safely `catch` around, since Next.js relies on that error
 * propagating to render the not-found boundary).
 *
 * - Outside mock mode, or for a `sessionId` that doesn't match any donation
 *   (unknown or already-consumed session): `{ ok: false, error: "not_found" }`.
 * - `handleWebhookRequest` never throws — it turns a bad signature (400) or
 *   any internal error (500) into a JSON error `Response` instead. Left
 *   unchecked, that failure would be invisible here: the donation would stay
 *   `pending` while the caller still reported success and sent the donor to
 *   the result page to poll for up to 5 minutes. `res.ok` is checked so a
 *   failure comes back as `{ ok: false, error: "simulate_failed" }` instead.
 */
export async function runSimulatedPayment(
  deps: Deps,
  sessionId: string,
  outcome: "succeeded" | "failed",
): Promise<SimulatedPaymentResult> {
  if (!isMockMode(deps.env)) {
    return { ok: false, error: "not_found" };
  }

  const donationRow = await getDonationBySession(deps, sessionId);
  if (!donationRow) return { ok: false, error: "not_found" };

  const provider = getPaymentProvider(deps.env);
  const req = await buildMockWebhookRequest({
    secret: deps.env.MOCK_WEBHOOK_SECRET,
    sessionId,
    outcome,
    baseUrl: deps.env.BETTER_AUTH_URL,
  });
  const res = await handleWebhookRequest(deps, provider, req);
  if (!res.ok) {
    return { ok: false, error: "simulate_failed" };
  }

  const status = await getDonationStatus(deps, donationRow.id);
  if (!status) return { ok: false, error: "not_found" };

  return { ok: true, redirectTo: `/${status.slug}/result?d=${donationRow.id}` };
}
