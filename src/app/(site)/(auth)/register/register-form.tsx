"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Card sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          สมัครสมาชิก
        </Typography>

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
              autoComplete="new-password"
              required
              fullWidth
            />
            <TextField
              label="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              fullWidth
            />
            <Button type="submit" size="large" variant="contained" disabled={submitting} fullWidth>
              สมัครสมาชิก
            </Button>
          </Stack>
        </Box>

        <Typography variant="body2" sx={{ mt: 3, textAlign: "center" }}>
          มีบัญชีอยู่แล้ว?{" "}
          <Link component={NextLink} href="/login">
            เข้าสู่ระบบ
          </Link>
        </Typography>
      </Card>
    </Container>
  );
}
