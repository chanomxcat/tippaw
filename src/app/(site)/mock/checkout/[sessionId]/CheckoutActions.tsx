"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import { simulatePayment } from "./actions";

const NOT_FOUND_MESSAGE = "ไม่พบรายการชำระเงินนี้ หรือหมดอายุแล้ว";
const SIMULATE_FAILED_MESSAGE = "จำลองการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง";

export function CheckoutActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
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
        return;
      }
      router.push(result.redirectTo);
    } catch {
      // The server action promise itself rejected unexpectedly (e.g. a
      // network/runtime error getting the request there at all, not one of
      // runSimulatedPayment's typed outcomes) — same generic message as a
      // simulate_failed result.
      setError(SIMULATE_FAILED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        type="button"
        variant="contained"
        color="success"
        disabled={pending || notFound}
        onClick={() => run("succeeded")}
        fullWidth
      >
        จำลองชำระสำเร็จ
      </Button>
      <Button
        type="button"
        variant="outlined"
        color="error"
        disabled={pending || notFound}
        onClick={() => run("failed")}
        fullWidth
      >
        จำลองชำระไม่สำเร็จ
      </Button>
    </Stack>
  );
}
