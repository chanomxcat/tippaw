"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/toast";
import { useHydrated } from "@/ui/use-hydrated";

export type ReplayButtonProps = {
  donationId: string;
};

/** Re-sends the overlay alert for one paid donation row, via `POST /api/donations/[id]/replay`. */
export function ReplayButton({ donationId }: ReplayButtonProps) {
  const hydrated = useHydrated();
  const { show: showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleReplay() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/donations/${donationId}/replay`, { method: "POST" });
      if (res.ok) {
        showToast("ส่ง alert แล้ว", "success");
      } else if (res.status === 409) {
        showToast("ยังไม่ได้ตั้งค่า Alert", "error");
      } else {
        showToast("ส่ง alert ไม่สำเร็จ", "error");
      }
    } catch {
      showToast("ส่ง alert ไม่สำเร็จ", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleReplay}
      disabled={!hydrated || submitting}
      className="btn btn-outline btn-sm"
    >
      Alert ซ้ำ
    </button>
  );
}
