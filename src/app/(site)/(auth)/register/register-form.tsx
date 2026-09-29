"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  invite_invalid: "invite code ไม่ถูกต้อง",
  rate_limited: "ลองใหม่อีกครั้งในอีกสักครู่",
  invalid_input: "ข้อมูลไม่ถูกต้อง",
  sign_up_failed: "สมัครสมาชิกไม่สำเร็จ ชื่อผู้ใช้นี้อาจถูกใช้แล้ว",
};

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(searchParams.get("code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, inviteCode }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = body?.error ?? "sign_up_failed";
        setError(ERROR_MESSAGES[code] ?? "สมัครสมาชิกไม่สำเร็จ ชื่อผู้ใช้นี้อาจถูกใช้แล้ว");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xs flex-col py-16">
      <div className="card bg-base-100 shadow p-8">
        <h1 className="mb-6 text-3xl font-medium">สมัครสมาชิก</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="register-username" className="label">
              <span>ชื่อผู้ใช้</span>
            </label>
            <input
              id="register-username"
              className="input w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="register-password" className="label">
              <span>รหัสผ่าน</span>
            </label>
            <input
              id="register-password"
              type="password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="register-invite-code" className="label">
              <span>Invite code</span>
            </label>
            <input
              id="register-invite-code"
              className="input w-full"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            สมัครสมาชิก
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          มีบัญชีอยู่แล้ว?{" "}
          <NextLink href="/login" className="link link-primary">
            เข้าสู่ระบบ
          </NextLink>
        </p>
      </div>
    </div>
  );
}
