"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useHydrated } from "@/ui/use-hydrated";

import { simulatePayment } from "./actions";

const NOT_FOUND_MESSAGE = "ไม่พบรายการชำระเงินนี้ หรือหมดอายุแล้ว";
const SIMULATE_FAILED_MESSAGE = "จำลองการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง";

export function CheckoutActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only for `not_found`: the session is gone/invalid, so retrying the
  // same buttons can never succeed — disable them rather than inviting a
  // pointless retry the way the `simulate_failed` message does.
  const [notFound, setNotFound] = useState(false);

  async function run(outcome: "succeeded" | "failed") {
    setPending(true);
    setError(null);
    try {
      const result = await simulatePayment(sessionId, outcome);
      if (!result.ok) {
        if (result.error === "not_found") {
          setNotFound(true);
          setError(NOT_FOUND_MESSAGE);
        } else {
          setError(SIMULATE_FAILED_MESSAGE);
        }
        setPending(false);
        return;
      }
      // Success: leave `pending` true (no `finally` resetting it) — we're
      // about to navigate away via `router.push`, and re-enabling both
      // buttons for the moment before that completes would let a second
      // click fire another `simulatePayment` for the same session.
      router.push(result.redirectTo);
    } catch {
      // The server action promise itself rejected unexpectedly (e.g. a
      // network/runtime error getting the request there at all, not one of
      // runSimulatedPayment's typed outcomes) — same generic message as a
      // simulate_failed result.
      setError(SIMULATE_FAILED_MESSAGE);
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        className="btn btn-success btn-block"
        disabled={!hydrated || pending || notFound}
        onClick={() => run("succeeded")}
      >
        จำลองชำระสำเร็จ
      </button>
      <button
        type="button"
        className="btn btn-outline btn-error btn-block"
        disabled={!hydrated || pending || notFound}
        onClick={() => run("failed")}
      >
        จำลองชำระไม่สำเร็จ
      </button>
    </div>
  );
}
