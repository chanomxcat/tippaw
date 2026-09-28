import { z } from "zod";

import { charLength, maxChars } from "@/server/lib/text";

/** Animation styles available for alert overlay entrance/exit transitions. */
export const ANIMATIONS = ["fade", "slide-up", "slide-down", "zoom"] as const;
export type Animation = (typeof ANIMATIONS)[number];

/** Built-in alert sound presets, referenced as `preset:<key>` in `soundUrl`. */
export const SOUND_PRESETS = ["chime", "coin", "pop"] as const;
export type SoundPreset = (typeof SOUND_PRESETS)[number];

const PRESET_SOUND_FORMAT = new RegExp(`^preset:(${SOUND_PRESETS.join("|")})$`);

/** True for an `https://` URL that parses as valid; used to gate user-supplied media links. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const httpsUrlSchema = z.string().refine(isHttpsUrl, {
  message: "must be an https:// URL",
});

const nonEmpty = (n: number) =>
  maxChars(n).refine((s) => charLength(s) >= 1, { message: "required" });

/** A single alert variant: the visual/audio treatment shown for a donation tier. */
export const alertVariantSchema = z.object({
  name: nonEmpty(50),
  minAmountSatang: z.number().int().min(0),
  weight: z.number().int().min(0).max(100),
  messageTemplate: nonEmpty(200),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  // Phase 1 ships a single font; the schema pins it so future fonts are an explicit change.
  fontFamily: z.literal("Prompt"),
  fontSize: z.number().int().min(12).max(120),
  imageUrl: httpsUrlSchema.nullable(),
  soundUrl: z
    .union([httpsUrlSchema, z.string().regex(PRESET_SOUND_FORMAT)])
    .nullable(),
  animationIn: z.enum(ANIMATIONS),
  animationOut: z.enum(ANIMATIONS),
  durationMs: z.number().int().min(1000).max(60000),
});

export type AlertVariant = z.infer<typeof alertVariantSchema>;

/** The single default variant every streamer starts with. */
export const DEFAULT_ALERT_VARIANT: AlertVariant = {
  name: "ค่าเริ่มต้น",
  minAmountSatang: 0,
  weight: 100,
  messageTemplate: "{name} โดเนท {amount} บาท",
  textColor: "#FFFFFF",
  fontFamily: "Prompt",
  fontSize: 36,
  imageUrl: null,
  soundUrl: "preset:chime",
  animationIn: "fade",
  animationOut: "fade",
  durationMs: 8000,
};

/** Per-streamer overlay settings: the minimum donation amount that triggers an alert. */
export const alertOverlaySettingsSchema = z.object({
  minAmountSatang: z.number().int().min(0),
});

export type AlertOverlaySettings = z.infer<typeof alertOverlaySettingsSchema>;

export const DEFAULT_ALERT_SETTINGS: AlertOverlaySettings = {
  minAmountSatang: 1000,
};
