import { and, asc, eq } from "drizzle-orm";

import type { AlertVariant, AlertOverlaySettings } from "@/server/alerts/schemas";
import { alertOverlaySettingsSchema, DEFAULT_ALERT_SETTINGS } from "@/server/alerts/schemas";
import { alertVariant, overlay } from "@/server/db/schema";
import type { Db, Deps } from "@/server/env";
import { randomToken } from "@/server/lib/random";
import { disconnectToken } from "@/server/realtime/publish";

/** The overlay kinds a streamer can have (one row each, see the `overlay` table). */
export type OverlayType = "alert" | "gift" | "top" | "recent" | "goal";

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

/**
 * Looks up which streamer/overlay-type owns `token`. The single token → room
 * lookup used both by the realtime route (to find the streamer's Durable
 * Object) and by the overlay settings API (to validate a token after reset).
 */
export async function findOverlayByToken(
  db: Db,
  token: string,
): Promise<{ streamerId: string; type: OverlayType } | null> {
  const row = await db.query.overlay.findFirst({
    where: eq(overlay.token, token),
    columns: { streamerId: true, type: true },
  });
  return row ?? null;
}

/** `Deps`-based wrapper around {@link findOverlayByToken} for callers that already have `deps`. */
export async function getOverlayByToken(
  deps: Deps,
  token: string,
): Promise<{ streamerId: string; type: OverlayType } | null> {
  return findOverlayByToken(deps.db, token);
}

/** Replaces a streamer's alert overlay settings and their single alert variant's fields. */
export async function updateAlertOverlay(
  deps: Deps,
  streamerId: string,
  input: { settings: AlertOverlaySettings; variant: AlertVariant },
): Promise<void> {
  await deps.db
    .update(overlay)
    .set({ settings: input.settings, updatedAt: deps.now() })
    .where(and(eq(overlay.streamerId, streamerId), eq(overlay.type, "alert")));

  const variantRow = await deps.db.query.alertVariant.findFirst({
    where: eq(alertVariant.streamerId, streamerId),
    orderBy: asc(alertVariant.sortOrder),
  });
  if (!variantRow) return;

  const { variant } = input;
  await deps.db
    .update(alertVariant)
    .set({
      name: variant.name,
      minAmountSatang: variant.minAmountSatang,
      weight: variant.weight,
      messageTemplate: variant.messageTemplate,
      textColor: variant.textColor,
      fontFamily: variant.fontFamily,
      fontSize: variant.fontSize,
      imageUrl: variant.imageUrl,
      soundUrl: variant.soundUrl,
      animationIn: variant.animationIn,
      animationOut: variant.animationOut,
      durationMs: variant.durationMs,
    })
    .where(eq(alertVariant.id, variantRow.id));
}

/**
 * Issues a fresh token for a streamer's overlay of `type`, then disconnects
 * any sockets still connected with the old one. The DB is updated first so
 * the new URL is live even if the disconnect call fails (logged, not
 * thrown) — a rare Durable Object hiccup shouldn't block the reset.
 */
export async function resetOverlayToken(
  deps: Deps,
  streamerId: string,
  type: OverlayType,
): Promise<string> {
  const overlayRow = await deps.db.query.overlay.findFirst({
    where: and(eq(overlay.streamerId, streamerId), eq(overlay.type, type)),
  });
  if (!overlayRow) throw new Error(`no ${type} overlay for streamer ${streamerId}`);

  const newToken = randomToken();
  await deps.db
    .update(overlay)
    .set({ token: newToken, updatedAt: deps.now() })
    .where(eq(overlay.id, overlayRow.id));

  try {
    await disconnectToken(deps.env, streamerId, overlayRow.token);
  } catch (err) {
    console.error(err);
  }

  return newToken;
}
