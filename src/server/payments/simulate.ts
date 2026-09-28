import type { Deps } from "@/server/env";
import { getDonationStatus, getDonationBySession } from "@/server/donations/queries";
import { handleWebhookRequest } from "@/server/donations/handle-payment-event";
import { buildMockWebhookRequest } from "@/server/payments/mock";
import { getPaymentProvider } from "@/server/payments";

export type SimulatedPaymentResult = { redirectTo: string };

/**
 * Applies a simulated mock-checkout outcome to the donation behind
 * `sessionId`, in-process (never over `fetch` — Workers can't call back into
 * themselves). Builds a signed mock webhook request with
 * `buildMockWebhookRequest` and hands it straight to `handleWebhookRequest`,
 * the same path a real provider's webhook takes, so the flow stays
 * idempotent and exercises the real alert-publishing code.
 *
 * Returns `null` when `sessionId` doesn't match any donation (unknown or
 * already-consumed session), so the caller (the `simulatePayment` server
 * action) can 404.
 */
export async function runSimulatedPayment(
  deps: Deps,
  sessionId: string,
  outcome: "succeeded" | "failed",
): Promise<SimulatedPaymentResult | null> {
  const donationRow = await getDonationBySession(deps, sessionId);
  if (!donationRow) return null;

  const provider = getPaymentProvider(deps.env);
  const req = await buildMockWebhookRequest({
    secret: deps.env.MOCK_WEBHOOK_SECRET,
    sessionId,
    outcome,
    baseUrl: deps.env.BETTER_AUTH_URL,
  });
  await handleWebhookRequest(deps, provider, req);

  const status = await getDonationStatus(deps, donationRow.id);
  if (!status) return null;

  return { redirectTo: `/${status.slug}/result?d=${donationRow.id}` };
}
