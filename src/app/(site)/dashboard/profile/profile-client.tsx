"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { ERROR_MESSAGES } from "@/ui/error-messages";

export type ProfileClientProps = {
  slug: string;
  payout: { provider: string; status: string } | null;
  baseUrl: string;
  mockMode: boolean;
};

export function ProfileClient({ slug: initialSlug, payout: initialPayout, baseUrl, mockMode }: ProfileClientProps) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [slug, setSlug] = useState(initialSlug);
  const [savedSlug, setSavedSlug] = useState(initialSlug);
  const [payout, setPayout] = useState(initialPayout);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const tipPageUrl = `${baseUrl}/${savedSlug}`;

  async function handleSaveSlug(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[body?.error ?? ""] ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const data = (await res.json()) as { slug: string };
      setSavedSlug(data.slug);
      setSlug(data.slug);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConnectPayout() {
    setConnecting(true);
    try {
      const res = await fetch("/api/profile/payout", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { status: "active" | "pending"; onboardingUrl?: string };
        setPayout({ provider: "mock", status: data.status });
        if (data.onboardingUrl) {
          window.location.href = data.onboardingUrl;
        }
      }
    } finally {
      setConnecting(false);
    }
  }

  function copyTipPageUrl() {
    navigator.clipboard
      ?.writeText(tipPageUrl)
      .then(() => showToast("คัดลอกลิงก์แล้ว"))
      .catch(() => showToast("คัดลอกไม่สำเร็จ", "error"));
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">โปรไฟล์</h1>

      <div className="card bg-base-100 shadow p-6">
        <form onSubmit={handleSaveSlug} className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-slug" className="label">
              <span>Slug</span>
            </label>
            <input
              id="profile-slug"
              className="input w-full"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>

          <div className="flex min-w-0 items-center gap-1">
            <a
              href={`/${savedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover min-w-0 break-all"
            >
              {tipPageUrl}
            </a>
            <button
              type="button"
              aria-label="คัดลอกลิงก์หน้า Tip"
              onClick={copyTipPageUrl}
              className="btn btn-ghost btn-square btn-sm"
            >
              <Copy size={16} />
            </button>
          </div>

          <button type="submit" className="btn btn-primary self-start" disabled={submitting}>
            บันทึก
          </button>
        </form>
      </div>

      <div className="card bg-base-100 shadow p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">ช่องทางรับเงิน</h2>
            {mockMode && <span className="badge badge-warning badge-sm">โหมดทดสอบ</span>}
          </div>
          <p className="text-base-content/60 text-sm">
            สถานะ: {payout?.status === "active" ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
          </p>
          <button
            type="button"
            onClick={handleConnectPayout}
            disabled={connecting || payout?.status === "active"}
            className="btn btn-primary self-start"
          >
            เชื่อมต่อ Stripe
          </button>
        </div>
      </div>
    </div>
  );
}
