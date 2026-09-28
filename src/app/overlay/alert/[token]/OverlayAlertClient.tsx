"use client";

import { useEffect, useRef, useState } from "react";

import { AlertPlayer, type AlertEvent } from "@/overlay/AlertPlayer";
import { createQueue } from "@/overlay/queue";
import { connectOverlay } from "@/overlay/ws-client";

/**
 * Client-side driver for the alert overlay: connects to the streamer's
 * realtime room, queues incoming `alert` events, and hands each one to
 * `AlertPlayer` one at a time.
 */
export function OverlayAlertClient({ token }: { token: string }) {
  const [current, setCurrent] = useState<AlertEvent | null>(null);
  const resolvePlayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const queue = createQueue<AlertEvent>(
      (event) =>
        new Promise<void>((resolve) => {
          resolvePlayRef.current = resolve;
          setCurrent(event);
        }),
    );

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const handle = connectOverlay({
      url: `${protocol}://${window.location.host}/api/realtime/${token}`,
      onEvent: (event) => {
        if (event.type === "alert") {
          queue.push(event);
        }
      },
    });

    return () => handle.close();
  }, [token]);

  function handleDone(): void {
    setCurrent(null);
    resolvePlayRef.current?.();
    resolvePlayRef.current = null;
  }

  return <AlertPlayer event={current} onDone={handleDone} />;
}
