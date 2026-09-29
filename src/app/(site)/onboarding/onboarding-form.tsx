"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ERROR_MESSAGES } from "@/ui/error-messages";

export type OnboardingFormProps = {
  needsInvite: boolean;
};

export function OnboardingForm({ needsInvite }: OnboardingFormProps) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsInvite ? { inviteCode, slug } : { slug }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = body?.error ?? "invalid_input";
        setError(ERROR_MESSAGES[code] ?? "ข้อมูลไม่ถูกต้อง");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const slugPreview = slug.trim().toLowerCase() || "your-slug";

  return (
    <div className="mx-auto flex max-w-xs flex-col py-16">
      <div className="card bg-base-100 shadow p-8">
        <h1 className="mb-1 text-3xl font-medium">ตั้งค่าบัญชี</h1>
        <p className="text-base-content/60 mb-6 text-sm">ก่อนเริ่มใช้งาน กรุณากรอกข้อมูลให้ครบ</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {needsInvite && (
            <div className="flex flex-col gap-1">
              <label htmlFor="onboarding-invite-code" className="label">
                <span>Invite code</span>
              </label>
              <input
                id="onboarding-invite-code"
                className="input w-full"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="onboarding-slug" className="label">
              <span>Slug</span>
            </label>
            <input
              id="onboarding-slug"
              className="input w-full"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-describedby="onboarding-slug-hint"
              required
            />
            <div className="label">
              <span id="onboarding-slug-hint" className="text-xs">{`tippaw.../${slugPreview}`}</span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            บันทึก
          </button>
        </form>
      </div>
    </div>
  );
}
