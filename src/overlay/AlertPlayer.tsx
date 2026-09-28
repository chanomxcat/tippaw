"use client";

import { useEffect, useRef, useState } from "react";

import type { RealtimeEvent } from "@/server/realtime/events";

import "@/overlay/alert.css";

/** The one `RealtimeEvent` variant `AlertPlayer` knows how to render. */
export type AlertEvent = Extract<RealtimeEvent, { type: "alert" }>;

export type AlertPlayerProps = {
  event: AlertEvent | null;
  onDone: () => void;
};

type Phase = "in" | "hold" | "out";

const TRANSITION_MS = 500;

/**
 * Renders a single alert: entrance animation (`tp-in-{animationIn}`, 500ms),
 * a hold for `durationMs`, then an exit animation (`tp-out-{animationOut}`,
 * 500ms), calling `onDone` once the exit finishes. Plays the variant's sound
 * (best-effort — OBS allows autoplay, but a plain browser tab may reject
 * it) and shows its image, hiding it on load failure. `headline` and
 * `message` are always rendered as plain text children (never
 * `dangerouslySetInnerHTML`) since they can contain arbitrary donor input.
 */
export function AlertPlayer({ event, onDone }: AlertPlayerProps) {
  const [phase, setPhase] = useState<Phase>("in");
  const [imageOk, setImageOk] = useState(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!event) return;
    setPhase("in");
    setImageOk(true);

    if (event.variant.soundUrl) {
      const audio = new Audio(event.variant.soundUrl);
      audio.play().catch(() => {});
    }

    const timers = [
      setTimeout(() => setPhase("hold"), TRANSITION_MS),
      setTimeout(() => setPhase("out"), TRANSITION_MS + event.variant.durationMs),
      setTimeout(() => onDoneRef.current(), 2 * TRANSITION_MS + event.variant.durationMs),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
    // Only the identity of the alert (its id) should restart the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  if (!event) return null;

  const animationClass =
    phase === "in"
      ? `tp-in-${event.variant.animationIn}`
      : phase === "out"
        ? `tp-out-${event.variant.animationOut}`
        : "";

  return (
    <div
      className={animationClass}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
        color: event.variant.textColor,
        fontFamily: `var(--font-prompt), "${event.variant.fontFamily}", sans-serif`,
        fontSize: event.variant.fontSize,
      }}
    >
      {imageOk && event.variant.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external, arbitrary streamer-supplied URL
        <img
          src={event.variant.imageUrl}
          alt=""
          style={{ maxWidth: 400, maxHeight: 300, objectFit: "contain" }}
          onError={() => setImageOk(false)}
        />
      )}
      <div>{event.headline}</div>
      {event.message && <div>{event.message}</div>}
    </div>
  );
}
