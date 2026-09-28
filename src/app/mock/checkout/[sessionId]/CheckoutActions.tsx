"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import { simulatePayment } from "./actions";

export function CheckoutActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(outcome: "succeeded" | "failed") {
    setPending(true);
    try {
      const { redirectTo } = await simulatePayment(sessionId, outcome);
      router.push(redirectTo);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack spacing={2}>
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
