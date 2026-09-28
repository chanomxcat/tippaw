"use client";

import { useState } from "react";

import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";

import { useHydrated } from "@/ui/use-hydrated";

export type ReplayButtonProps = {
  donationId: string;
};

/** Re-sends the overlay alert for one paid donation row, via `POST /api/donations/[id]/replay`. */
export function ReplayButton({ donationId }: ReplayButtonProps) {
  const hydrated = useHydrated();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleReplay() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/donations/${donationId}/replay`, { method: "POST" });
      if (res.ok) {
        setToast("ส่ง alert แล้ว");
      } else if (res.status === 409) {
        setToast("ยังไม่ได้ตั้งค่า Alert");
      } else {
        setToast("ส่ง alert ไม่สำเร็จ");
      }
    } catch {
      setToast("ส่ง alert ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="outlined" size="small" onClick={handleReplay} disabled={!hydrated || submitting}>
        Alert ซ้ำ
      </Button>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </>
  );
}
