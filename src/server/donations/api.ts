import { clientIp, jsonError, parseJson } from "@/server/http";
import type { Deps } from "@/server/env";
import { getPaymentProvider } from "@/server/payments";
import { createDonation, donationInputSchema } from "./create-donation";
import { handleWebhookRequest } from "./handle-payment-event";
import { getDonationStatus } from "./queries";

/**
 * `POST /api/donations`: rate-limited by IP, then creates a pending
 * donation and opens a checkout session. `not_found` (unknown slug) maps to
 * 404, `not_accepting` (streamer's payout isn't active) to 409.
 */
export async function handleCreateDonation(deps: Deps, req: Request): Promise<Response> {
  const ip = clientIp(req);
  const { success } = await deps.env.DONATION_RATE_LIMITER.limit({ key: ip });
  if (!success) return jsonError(429, "rate_limited");

  const parsed = await parseJson(donationInputSchema(deps.env), req);
  if (!parsed.ok) return parsed.response;

  const provider = getPaymentProvider(deps.env);
  const result = await createDonation(deps, provider, parsed.data);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return jsonError(status, result.reason);
  }

  return Response.json({ checkoutUrl: result.checkoutUrl });
}

/** `GET /api/donations/[id]/status`: the donor-facing status poll used by the result page. */
export async function handleDonationStatus(deps: Deps, id: string): Promise<Response> {
  const status = await getDonationStatus(deps, id);
  if (!status) return jsonError(404, "not_found");

  return Response.json({ status: status.status });
}

/** `POST /api/webhooks/payment`: verifies and applies a payment provider webhook event. */
export async function handlePaymentWebhook(deps: Deps, req: Request): Promise<Response> {
  const provider = getPaymentProvider(deps.env);
  return handleWebhookRequest(deps, provider, req);
}
