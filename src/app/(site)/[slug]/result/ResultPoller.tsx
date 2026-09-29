"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
      <div className="surface p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner" />
          <p>กำลังตรวจสอบการชำระเงิน...</p>
        </div>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="surface p-8">
        <div role="alert" className="alert alert-success">
          <span>{successMessage || "ขอบคุณสำหรับการสนับสนุน!"}</span>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="surface p-8">
        <div className="flex flex-col gap-4">
          <div role="alert" className="alert alert-error">
            <span>{failureMessage || "การชำระเงินไม่สำเร็จ"}</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => router.push(`/${slug}`)}>
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface p-8">
      <div role="alert" className="alert alert-warning">
        <span>ยังไม่ได้รับการยืนยันการชำระเงิน</span>
      </div>
    </div>
  );
}
