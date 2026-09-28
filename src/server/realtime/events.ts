import type { Animation } from "@/server/alerts/schemas";

/** The resolved, ready-to-render treatment for an alert — no editor-only fields (name/min/weight/template). */
export type AlertVariantRender = {
  textColor: string;
  fontFamily: string;
  fontSize: number;
  imageUrl: string | null;
  soundUrl: string | null;
  animationIn: Animation;
  animationOut: Animation;
  durationMs: number;
};

/**
 * Events broadcast over the streamer's realtime room to the overlay.
 * `gift` and `settings.updated` are added in a later phase.
 */
export type RealtimeEvent =
  | {
      type: "alert";
      id: string;
      donorName: string;
      amountSatang: number;
      message: string;
      headline: string;
      variant: AlertVariantRender;
    }
  | {
      type: "donation.paid";
      donorName: string;
      amountSatang: number;
      paidAt: string;
    };
