import { describe, expect, it } from "vitest";

import { buildAlertEvent, resolveSoundUrl } from "@/server/alerts/build-event";
import { renderTemplate } from "@/server/alerts/render-template";
import { alertVariantSchema, DEFAULT_ALERT_VARIANT } from "@/server/alerts/schemas";
import { selectVariant } from "@/server/alerts/select-variant";

describe("selectVariant", () => {
  it("returns null for an empty variant list", () => {
    expect(selectVariant([], 1000)).toBeNull();
  });

  const tiered = [
    { minAmountSatang: 0, weight: 100, id: "a" },
    { minAmountSatang: 10000, weight: 70, id: "b" },
    { minAmountSatang: 10000, weight: 30, id: "c" },
  ];

  it("picks the first variant in the top tier whose cumulative weight passes r", () => {
    expect(selectVariant(tiered, 15000, () => 0.69)?.id).toBe("b");
  });

  it("picks the next variant once r crosses the previous cumulative weight", () => {
    expect(selectVariant(tiered, 15000, () => 0.7)?.id).toBe("c");
  });

  it("falls back to a lower tier when the amount doesn't reach the higher one", () => {
    expect(selectVariant(tiered, 5000, () => 0)?.id).toBe("a");
  });

  it("selects uniformly by index when the top tier's weights are all zero", () => {
    const zeroWeightTier = [
      { minAmountSatang: 0, weight: 100, id: "a" },
      { minAmountSatang: 10000, weight: 0, id: "b" },
      { minAmountSatang: 10000, weight: 0, id: "c" },
    ];
    expect(selectVariant(zeroWeightTier, 15000, () => 0.6)?.id).toBe("c");
  });

  it("returns null when every variant's minimum exceeds the amount", () => {
    expect(selectVariant(tiered, -1)).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("substitutes name and amount without escaping", () => {
    expect(
      renderTemplate("{name} โดเนท {amount} บาท", {
        name: "<b>แมว</b>",
        amountSatang: 123400,
        message: "",
      }),
    ).toBe("<b>แมว</b> โดเนท 1,234 บาท");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(
      renderTemplate("{unknown} {name}", { name: "แมว", amountSatang: 0, message: "" }),
    ).toBe("{unknown} แมว");
  });
});

describe("resolveSoundUrl", () => {
  it("resolves a preset key to its static path", () => {
    expect(resolveSoundUrl("preset:coin")).toBe("/presets/sounds/coin.wav");
  });

  it("returns an https URL unchanged", () => {
    expect(resolveSoundUrl("https://example.com/sound.mp3")).toBe(
      "https://example.com/sound.mp3",
    );
  });

  it("returns null for null", () => {
    expect(resolveSoundUrl(null)).toBeNull();
  });
});

describe("alertVariantSchema", () => {
  it("rejects a non-https soundUrl", () => {
    expect(
      alertVariantSchema.safeParse({ ...DEFAULT_ALERT_VARIANT, soundUrl: "http://x" }).success,
    ).toBe(false);
  });

  it("rejects a textColor that isn't a full 6-digit hex", () => {
    expect(
      alertVariantSchema.safeParse({ ...DEFAULT_ALERT_VARIANT, textColor: "#FFF" }).success,
    ).toBe(false);
  });

  it("rejects a sound preset key that isn't in SOUND_PRESETS", () => {
    expect(
      alertVariantSchema.safeParse({ ...DEFAULT_ALERT_VARIANT, soundUrl: "preset:boom" }).success,
    ).toBe(false);
  });

  it("accepts the default variant", () => {
    expect(alertVariantSchema.safeParse(DEFAULT_ALERT_VARIANT).success).toBe(true);
  });
});

describe("buildAlertEvent", () => {
  it("builds an alert event with a rendered headline and resolved sound", () => {
    const event = buildAlertEvent({
      id: "evt-1",
      donorName: "แมว",
      amountSatang: 123400,
      message: "สู้ๆ",
      variant: DEFAULT_ALERT_VARIANT,
    });

    expect(event).toEqual({
      type: "alert",
      id: "evt-1",
      donorName: "แมว",
      amountSatang: 123400,
      message: "สู้ๆ",
      headline: "แมว โดเนท 1,234 บาท",
      variant: {
        textColor: "#FFFFFF",
        fontFamily: "Prompt",
        fontSize: 36,
        imageUrl: null,
        soundUrl: "/presets/sounds/chime.wav",
        animationIn: "fade",
        animationOut: "fade",
        durationMs: 8000,
      },
    });
  });
});
