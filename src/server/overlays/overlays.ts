import { and, asc, eq } from "drizzle-orm";

import type { AlertVariant, AlertOverlaySettings } from "@/server/alerts/schemas";
import { alertOverlaySettingsSchema, DEFAULT_ALERT_SETTINGS } from "@/server/alerts/schemas";
import { alertVariant, overlay } from "@/server/db/schema";
import type { Deps } from "@/server/env";

/** Maps an `alert_variant` DB row to the `AlertVariant` shape (plus its id), backfilling
 * style fields from sensible fallbacks in case older rows left them null. */
function mapVariantRow(row: typeof alertVariant.$inferSelect): AlertVariant & { id: string } {
  return {
    id: row.id,
    name: row.name,
    minAmountSatang: row.minAmountSatang,
    weight: row.weight,
    messageTemplate: row.messageTemplate,
    textColor: row.textColor ?? "#FFFFFF",
    fontFamily: "Prompt",
    fontSize: row.fontSize ?? 36,
    imageUrl: row.imageUrl,
    soundUrl: row.soundUrl,
    animationIn: (row.animationIn as AlertVariant["animationIn"]) ?? "fade",
    animationOut: (row.animationOut as AlertVariant["animationOut"]) ?? "fade",
    durationMs: row.durationMs ?? 8000,
  };
}

/**
 * Loads a streamer's alert overlay (token + parsed settings) together with its
 * single alert variant (lowest `sortOrder`). Returns null when the streamer has
 * no alert overlay or no variant configured yet.
 */
export async function getAlertOverlayConfig(
  deps: Deps,
  streamerId: string,
): Promise<{
  overlay: { id: string; token: string; settings: AlertOverlaySettings };
  variant: AlertVariant & { id: string };
} | null> {
  const overlayRow = await deps.db.query.overlay.findFirst({
    where: and(eq(overlay.streamerId, streamerId), eq(overlay.type, "alert")),
  });
  if (!overlayRow) return null;

  const variantRow = await deps.db.query.alertVariant.findFirst({
    where: eq(alertVariant.streamerId, streamerId),
    orderBy: asc(alertVariant.sortOrder),
  });
  if (!variantRow) return null;

  const parsedSettings = alertOverlaySettingsSchema.safeParse(overlayRow.settings);
  const settings = parsedSettings.success ? parsedSettings.data : DEFAULT_ALERT_SETTINGS;

  return {
    overlay: { id: overlayRow.id, token: overlayRow.token, settings },
    variant: mapVariantRow(variantRow),
  };
}
