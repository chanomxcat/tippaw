"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Card sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          เข้าสู่ระบบ
        </Typography>

        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {hasGoogle && (
            <Button
              fullWidth
              size="large"
              variant="outlined"
              onClick={() => signInWithSocial("google")}
            >
              เข้าสู่ระบบด้วย Google
            </Button>
          )}
          {hasStreamlabs && (
            <Button
              fullWidth
              size="large"
              variant="outlined"
              onClick={() => signInWithSocial("streamlabs")}
            >
              เข้าสู่ระบบด้วย Streamlabs
            </Button>
          )}
        </Stack>

        {(hasGoogle || hasStreamlabs) && <Divider sx={{ mb: 3 }}>หรือ</Divider>}

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              fullWidth
            />
            <TextField
              label="รหัสผ่าน"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Button type="submit" size="large" variant="contained" disabled={submitting} fullWidth>
              เข้าสู่ระบบ
            </Button>
          </Stack>
        </Box>

        <Typography variant="body2" sx={{ mt: 3, textAlign: "center" }}>
          ยังไม่มีบัญชี?{" "}
          <Link component={NextLink} href="/register">
            สมัครสมาชิก
          </Link>
        </Typography>
      </Card>
    </Container>
  );
}
