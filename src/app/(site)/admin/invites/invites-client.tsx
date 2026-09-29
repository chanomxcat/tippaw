"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { Copy, Link as LinkIcon } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { inviteStatusLabel } from "@/server/admin/invite-status";
import { bangkokEndOfDay } from "@/server/lib/time";

export type InviteViewRow = {
  code: string;
  note: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  disabledAt: string | null;
  createdAt: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "ข้อมูลไม่ถูกต้อง",
  invalid_code: "รูปแบบโค้ดไม่ถูกต้อง (A-Z, 0-9, - ความยาว 4-32 ตัว)",
  duplicate: "โค้ดนี้มีอยู่แล้ว",
  expires_in_past: "วันหมดอายุต้องอยู่ในอนาคต",
  generate_failed: "สร้างโค้ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "-";
}

export function InvitesClient({ initialInvites }: { initialInvites: InviteViewRow[] }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [quota, setQuota] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  function resetForm() {
    setMode("random");
    setCode("");
    setNote("");
    setQuota("");
    setExpiresAt("");
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: mode === "custom" ? code : undefined,
          note: note.trim() ? note.trim() : undefined,
          maxUses: quota.trim() ? Number(quota) : null,
          expiresAt: expiresAt ? (bangkokEndOfDay(expiresAt) ?? new Date(expiresAt)).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[body?.error ?? ""] ?? "สร้างโค้ดไม่สำเร็จ");
        return;
      }
      setDialogOpen(false);
      resetForm();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDisabled(inviteCode: string, disabled: boolean) {
    setPendingCode(inviteCode);
    try {
      await fetch(`/api/admin/invites/${encodeURIComponent(inviteCode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      router.refresh();
    } finally {
      setPendingCode(null);
    }
  }

  function copyText(text: string, message: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => showToast(message))
      .catch(() => showToast("คัดลอกไม่สำเร็จ", "error"));
  }

  const now = new Date();

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invite codes</h1>
        <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>
          สร้างโค้ด
        </button>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>โค้ด</th>
                <th>หมายเหตุ</th>
                <th>ใช้แล้ว/โควตา</th>
                <th>หมดอายุ</th>
                <th>สถานะ</th>
                <th>สร้างเมื่อ</th>
                <th className="text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {initialInvites.map((invite) => {
                const status = inviteStatusLabel(
                  {
                    disabledAt: invite.disabledAt ? new Date(invite.disabledAt) : null,
                    expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : null,
                    maxUses: invite.maxUses,
                    usedCount: invite.usedCount,
                  },
                  now,
                );
                const disabled = Boolean(invite.disabledAt);
                const registerLink = `/register?code=${invite.code}`;

                return (
                  <tr key={invite.code}>
                    <td>
                      <NextLink href={`/admin/invites/${invite.code}`} className="link link-hover">
                        {invite.code}
                      </NextLink>
                    </td>
                    <td>{invite.note ?? "-"}</td>
                    <td>{`${invite.usedCount} / ${invite.maxUses ?? "∞"}`}</td>
                    <td>{formatDate(invite.expiresAt)}</td>
                    <td>{status}</td>
                    <td>{formatDate(invite.createdAt)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`คัดลอกโค้ด ${invite.code}`}
                          onClick={() => copyText(invite.code, "คัดลอกโค้ดแล้ว")}
                          className="btn btn-ghost btn-square btn-sm"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`คัดลอกลิงก์ ${invite.code}`}
                          onClick={() =>
                            copyText(`${window.location.origin}${registerLink}`, "คัดลอกลิงก์แล้ว")
                          }
                          className="btn btn-ghost btn-square btn-sm"
                        >
                          <LinkIcon size={16} />
                        </button>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={!disabled}
                          disabled={pendingCode === invite.code}
                          onChange={(e) => toggleDisabled(invite.code, !e.target.checked)}
                          aria-label={`เปิด/ปิดใช้งาน ${invite.code}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={dialogOpen} title="สร้างโค้ด" onClose={() => setDialogOpen(false)}>
        <form onSubmit={handleCreate} className="flex flex-col gap-4 pt-2">
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="invite-code-mode"
                className="radio"
                value="random"
                checked={mode === "random"}
                onChange={() => setMode("random")}
              />
              <span className="label-text">สุ่ม</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="invite-code-mode"
                className="radio"
                value="custom"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
              />
              <span className="label-text">กำหนดเอง</span>
            </label>
          </div>
          {mode === "custom" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="invite-code" className="label">
                <span className="label-text">โค้ด</span>
              </label>
              <input
                id="invite-code"
                className="input w-full"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-note" className="label">
              <span className="label-text">หมายเหตุ</span>
            </label>
            <input
              id="invite-note"
              className="input w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-quota" className="label">
              <span className="label-text">โควตา</span>
            </label>
            <input
              id="invite-quota"
              type="number"
              className="input w-full"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              min={1}
              max={10000}
            />
            <span className="text-base-content/60 text-xs">เว้นว่างสำหรับไม่จำกัด</span>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-expires-at" className="label">
              <span className="label-text">วันหมดอายุ</span>
            </label>
            <input
              id="invite-expires-at"
              type="date"
              className="input w-full"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <span className="text-base-content/60 text-xs">เว้นว่างสำหรับไม่มีวันหมดอายุ</span>
          </div>
          <div className="modal-action">
            <button type="button" className="btn" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              สร้าง
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
