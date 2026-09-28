import { buildAlertEvent } from "@/server/alerts/build-event";
import { selectVariant } from "@/server/alerts/select-variant";
import type { Deps } from "@/server/env";
import { getAlertOverlayConfig } from "@/server/overlays/overlays";
import { InvalidSignatureError } from "@/server/payments/types";
import type { PaymentEvent, PaymentProvider } from "@/server/payments/types";
import { publish } from "@/server/realtime/publish";
import type { RealtimeEvent } from "@/server/realtime/events";

export type HandlePaymentEventResult = {
  outcome: "duplicate" | "paid" | "failed" | "ignored";
  published: boolean;
};

/** Raw D1 row shape for `donation`, as returned by the `RETURNING *` update below. */
type DonationRow = {
  id: string;
  streamer_id: string;
  kind: string;
  gift_type_id: string | null;
  donor_name: string;
  message_raw: string | null;
  amount_satang: number;
  status: string;
  provider: string;
  provider_session_id: string | null;
  created_at: number;
  paid_at: number | null;
};

/**
 * Applies a payment provider webhook event to the `donation` it targets,
 * idempotently. Two D1 statements run in a single batch:
 *
 * 1. Record the provider's event id (`ON CONFLICT DO NOTHING`) — if this
 *    inserts nothing, the event was already processed: `duplicate`.
 * 2. Flip the matching pending donation to `paid`/`failed` — if this
 *    updates nothing (no such donation, or it wasn't `pending`): `ignored`.
 *
 * On `paid`, publishes an `alert` + `donation.paid` event to the streamer's
 * overlays when the amount clears the overlay's minimum and a variant is
 * selected. Publish failures are logged, never thrown.
 */
export async function handlePaymentEvent(
  deps: Deps,
  _providerName: string,
  event: PaymentEvent,
): Promise<HandlePaymentEventResult> {
  const status = event.type === "payment.succeeded" ? "paid" : "failed";
  const paidAtMs = status === "paid" ? deps.now().getTime() : null;
  const receivedAtMs = deps.now().getTime();

  const batchResults = await deps.env.DB.batch<Record<string, unknown>>([
    deps.env.DB.prepare(
      "INSERT INTO webhook_event (provider_event_id, received_at) VALUES (?, ?) ON CONFLICT DO NOTHING",
    ).bind(event.eventId, receivedAtMs),
    deps.env.DB.prepare(
      "UPDATE donation SET status = ?, paid_at = ? WHERE provider_session_id = ? AND status = 'pending' RETURNING *",
    ).bind(status, paidAtMs, event.sessionId),
  ]);
  const webhookInsert = batchResults[0]!;
  const donationUpdate = batchResults[1]!;

  if ((webhookInsert.meta.changes ?? 0) === 0) {
    return { outcome: "duplicate", published: false };
  }
  if ((donationUpdate.meta.changes ?? 0) === 0) {
    return { outcome: "ignored", published: false };
  }

  if (status === "failed") {
    return { outcome: "failed", published: false };
  }

  const row = donationUpdate.results[0] as unknown as DonationRow;
  const published = await publishPaidAlert(deps, row);
  return { outcome: "paid", published };
}

/** Publishes the alert + donation.paid events for a newly-paid donation, if eligible. Never throws. */
async function publishPaidAlert(deps: Deps, row: DonationRow): Promise<boolean> {
  try {
    const config = await getAlertOverlayConfig(deps, row.streamer_id);
    if (!config) return false;
    if (row.amount_satang < config.overlay.settings.minAmountSatang) return false;

    const variant = selectVariant([config.variant], row.amount_satang);
    if (!variant) return false;

    const alertEvent = buildAlertEvent({
      id: row.id,
      donorName: row.donor_name,
      amountSatang: row.amount_satang,
      message: row.message_raw ?? "",
      variant,
    });
    const paidEvent: RealtimeEvent = {
      type: "donation.paid",
      donorName: row.donor_name,
      amountSatang: row.amount_satang,
      paidAt: new Date(row.paid_at ?? deps.now().getTime()).toISOString(),
    };

    await publish(deps.env, row.streamer_id, alertEvent);
    await publish(deps.env, row.streamer_id, paidEvent);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

/**
 * Verifies and applies a payment webhook `Request`. Returns 400 on an
 * `InvalidSignatureError` (bad/missing signature), 500 on any other error,
 * and 200 `{ ok: true }` on success.
 */
export async function handleWebhookRequest(
  deps: Deps,
  provider: PaymentProvider,
  req: Request,
): Promise<Response> {
  let event: PaymentEvent;
  try {
    event = await provider.parseWebhook(req);
  } catch (err) {
    if (err instanceof InvalidSignatureError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  try {
    await handlePaymentEvent(deps, provider.name, event);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
