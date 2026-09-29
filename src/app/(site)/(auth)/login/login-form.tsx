"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";

export type LoginFormProps = {
  hasGoogle: boolean;
  hasStreamlabs: boolean;
};

export function LoginForm({ hasGoogle, hasStreamlabs }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithSocial(provider: string) {
    // /sign-in/social is POST-only and returns an authorize URL as JSON
    // rather than redirecting itself — the browser navigates there itself.
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, callbackURL: "/onboarding" }),
    });
    const body = (await res.json().catch(() => null)) as { url?: string } | null;
    if (res.ok && body?.url) {
      window.location.href = body.url;
    } else {
      setError("ไม่สามารถเข้าสู่ระบบได้ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col py-10">
      <div className="surface p-8">
        <h1 className="mb-6 text-3xl font-medium">เข้าสู่ระบบ</h1>

        <div className="mb-6 flex flex-col gap-3">
          {hasGoogle && (
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => signInWithSocial("google")}
            >
              เข้าสู่ระบบด้วย Google
            </button>
          )}
          {hasStreamlabs && (
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => signInWithSocial("streamlabs")}
            >
              เข้าสู่ระบบด้วย Streamlabs
            </button>
          )}
        </div>

        {(hasGoogle || hasStreamlabs) && <div className="divider mb-6">หรือ</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="login-username" className="label">
              <span>ชื่อผู้ใช้</span>
            </label>
            <input
              id="login-username"
              className="input w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="label">
              <span>รหัสผ่าน</span>
            </label>
            <input
              id="login-password"
              type="password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          ยังไม่มีบัญชี?{" "}
          <NextLink href="/register" className="link link-primary">
            สมัครสมาชิก
          </NextLink>
        </p>
      </div>
    </div>
  );
}
