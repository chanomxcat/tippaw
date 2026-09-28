"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

type PollStatus = "pending" | "paid" | "failed" | "timeout";

export type ResultPollerProps = {
  donationId: string;
  slug: string;
  successMessage: string;
  failureMessage: string;
};

export function ResultPoller({ donationId, slug, successMessage, failureMessage }: ResultPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<PollStatus>("pending");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function checkOnce(): Promise<boolean> {
      try {
        const res = await fetch(`/api/donations/${donationId}/status`);
        if (res.ok) {
          const data = (await res.json()) as { status: "pending" | "paid" | "failed" };
          if (data.status === "paid" || data.status === "failed") {
            if (!cancelled) setStatus(data.status);
            return true;
          }
        }
      } catch {
        // network hiccup — keep polling until timeout
      }
      return false;
    }

    const interval = window.setInterval(async () => {
      if (cancelled) return;
      const done = await checkOnce();
      if (done) {
        window.clearInterval(interval);
        return;
      }
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        if (!cancelled) setStatus("timeout");
        window.clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    void checkOnce();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [donationId]);

  if (status === "pending") {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress />
          <Typography>กำลังตรวจสอบการชำระเงิน...</Typography>
        </Stack>
      </Card>
    );
  }

  if (status === "paid") {
    return (
      <Card sx={{ p: 4 }}>
        <Alert severity="success">{successMessage || "ขอบคุณสำหรับการสนับสนุน!"}</Alert>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Alert severity="error">{failureMessage || "การชำระเงินไม่สำเร็จ"}</Alert>
          <Button variant="contained" onClick={() => router.push(`/${slug}`)}>
            ลองอีกครั้ง
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 4 }}>
      <Alert severity="warning">ยังไม่ได้รับการยืนยันการชำระเงิน</Alert>
    </Card>
  );
}
