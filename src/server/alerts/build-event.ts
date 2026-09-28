import { renderTemplate } from "@/server/alerts/render-template";
import type { AlertVariant } from "@/server/alerts/schemas";
import type { AlertVariantRender, RealtimeEvent } from "@/server/realtime/events";

const PRESET_SOUND_PATH: Record<string, string> = {
  chime: "/presets/sounds/chime.wav",
  coin: "/presets/sounds/coin.wav",
  pop: "/presets/sounds/pop.wav",
};

/** Resolves a variant's `soundUrl` (an https URL, a `preset:<key>`, or null) to a playable URL or null. */
export function resolveSoundUrl(soundUrl: string | null): string | null {
  if (soundUrl === null) return null;
  if (soundUrl.startsWith("preset:")) {
    const key = soundUrl.slice("preset:".length);
    return PRESET_SOUND_PATH[key] ?? null;
  }
  return soundUrl;
}

/** Builds the `alert` realtime event broadcast to the overlay for a paid donation. */
export function buildAlertEvent(input: {
  id: string;
  donorName: string;
  amountSatang: number;
  message: string;
  variant: AlertVariant;
}): Extract<RealtimeEvent, { type: "alert" }> {
  const { id, donorName, amountSatang, message, variant } = input;

  const render: AlertVariantRender = {
    textColor: variant.textColor,
    fontFamily: variant.fontFamily,
    fontSize: variant.fontSize,
    imageUrl: variant.imageUrl,
    soundUrl: resolveSoundUrl(variant.soundUrl),
    animationIn: variant.animationIn,
    animationOut: variant.animationOut,
    durationMs: variant.durationMs,
  };

  return {
    type: "alert",
    id,
    donorName,
    amountSatang,
    message,
    headline: renderTemplate(variant.messageTemplate, {
      name: donorName,
      amountSatang,
      message,
    }),
    variant: render,
  };
}
