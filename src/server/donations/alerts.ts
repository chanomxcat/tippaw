import { and, eq } from "drizzle-orm";

import { buildAlertEvent } from "@/server/alerts/build-event";
import { selectVariant } from "@/server/alerts/select-variant";
import { donation } from "@/server/db/schema";
import type { Deps } from "@/server/env";
import { getAlertOverlayConfig } from "@/server/overlays/overlays";
import { publish } from "@/server/realtime/publish";

/**
 * Re-broadcasts the alert for a streamer's own `paid` donation, ignoring the
 * overlay's minimum-amount setting. Returns `not_found` when the donation
 * doesn't exist, isn't `paid`, or doesn't belong to `streamerId`.
 */
export async function replayAlert(
  deps: Deps,
  streamerId: string,
  donationId: string,
): Promise<"ok" | "not_found"> {
  const row = await deps.db.query.donation.findFirst({
    where: and(
      eq(donation.id, donationId),
      eq(donation.streamerId, streamerId),
      eq(donation.status, "paid"),
    ),
  });
  if (!row) return "not_found";

  const config = await getAlertOverlayConfig(deps, streamerId);
  if (config) {
    const variant = selectVariant([config.variant], row.amountSatang);
    if (variant) {
      const alertEvent = buildAlertEvent({
        id: row.id,
        donorName: row.donorName,
        amountSatang: row.amountSatang,
        message: row.messageRaw ?? "",
        variant,
      });
      try {
        await publish(deps.env, streamerId, alertEvent);
      } catch (err) {
        console.error(err);
      }
    }
  }

  return "ok";
}

const TEST_ALERT_DONOR_NAME = "TipPaw";
const TEST_ALERT_AMOUNT_SATANG = 10000;
const TEST_ALERT_MESSAGE = "นี่คือการทดสอบ alert";

/**
 * Publishes a synthetic alert for `streamerId` to preview overlay styling,
 * ignoring the overlay's minimum-amount setting. No donation is recorded.
 */
export async function sendTestAlert(deps: Deps, streamerId: string): Promise<void> {
  const config = await getAlertOverlayConfig(deps, streamerId);
  if (!config) return;

  const variant = selectVariant([config.variant], TEST_ALERT_AMOUNT_SATANG);
  if (!variant) return;

  const alertEvent = buildAlertEvent({
    id: crypto.randomUUID(),
    donorName: TEST_ALERT_DONOR_NAME,
    amountSatang: TEST_ALERT_AMOUNT_SATANG,
    message: TEST_ALERT_MESSAGE,
    variant,
  });

  try {
    await publish(deps.env, streamerId, alertEvent);
  } catch (err) {
    console.error(err);
  }
}
