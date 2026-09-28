"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import { simulatePayment } from "./actions";

const SIMULATE_FAILED_MESSAGE = "จำลองการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง";

export function CheckoutActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(outcome: "succeeded" | "failed") {
    setPending(true);
    setError(null);
    try {
      const result = await simulatePayment(sessionId, outcome);
      if (!result.ok) {
        setError(SIMULATE_FAILED_MESSAGE);
        return;
      }
      router.push(result.redirectTo);
    } catch {
      // The server action promise itself rejected (e.g. a network/runtime
      // error getting the request there at all) — same user-facing message
      // as an { ok: false } result.
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
        disabled={pending}
        onClick={() => run("succeeded")}
        fullWidth
      >
        จำลองชำระสำเร็จ
      </Button>
      <Button
        type="button"
        variant="outlined"
        color="error"
        disabled={pending}
        onClick={() => run("failed")}
        fullWidth
      >
        จำลองชำระไม่สำเร็จ
      </Button>
    </Stack>
  );
}
