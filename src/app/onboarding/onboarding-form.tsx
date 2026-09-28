"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const ERROR_MESSAGES: Record<string, string> = {
  invite_invalid: "invite code ไม่ถูกต้อง",
  slug_format: "slug ต้องเป็น a-z, 0-9 หรือ - ยาว 3–30 ตัว",
  slug_reserved: "slug นี้ถูกสงวนไว้",
  slug_taken: "slug นี้มีคนใช้แล้ว",
  rate_limited: "ลองใหม่อีกครั้งในอีกสักครู่",
  invalid_input: "ข้อมูลไม่ถูกต้อง",
  unauthorized: "กรุณาเข้าสู่ระบบอีกครั้ง",
};

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
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Card sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          ตั้งค่าบัญชี
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          ก่อนเริ่มใช้งาน กรุณากรอกข้อมูลให้ครบ
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {needsInvite && (
              <TextField
                label="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                fullWidth
              />
            )}
            <TextField
              label="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              helperText={`tippaw.../${slugPreview}`}
              required
              fullWidth
            />
            <Button type="submit" size="large" variant="contained" disabled={submitting} fullWidth>
              บันทึก
            </Button>
          </Stack>
        </Box>
      </Card>
    </Container>
  );
}
