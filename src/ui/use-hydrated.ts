"use client";

import { useSyncExternalStore } from "react";

// Never notifies — this store's snapshot never changes on its own. The
// server/client snapshot split below is what does the work (see the
// docstring), not a real subscription.
function subscribe(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * True once this component has hydrated on the client; false during SSR
 * and during the client's very first (hydration) render.
 *
 * A server-rendered interactive control — a button with only an `onClick`,
 * a form with only an `onSubmit` — renders fully enabled before React has
 * attached any event handlers to it. A click or an Enter-key submit that
 * lands in that window is not queued or retried: it silently does nothing
 * (a button) or falls back to the browser's native, handler-less behavior
 * (a form, e.g. a plain GET navigation that discards whatever the user
 * typed). This is a real, confirmed failure mode here, not a theoretical
 * one — traced via a request log showing the expected request never
 * reaching the server, not merely arriving late. Gate an interactive
 * control's `disabled` on `!useHydrated()` (in addition to its own
 * pending/error state) to close that window.
 *
 * Implemented via `useSyncExternalStore` rather than a `useState` +
 * `useEffect(() => setState(true), [])` pair: React calls
 * `getServerSnapshot` both during the server render and during the
 * client's first (hydrating) render, so the two agree and there's no
 * hydration-mismatch warning; only the client's *next* render — scheduled
 * automatically once hydration finishes — calls `getClientSnapshot` and
 * flips to `true`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
