"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { Iconify } from "@/ui/minimal/components/iconify";
import { ERROR_MESSAGES } from "@/ui/error-messages";

export type ProfileClientProps = {
  slug: string;
  payout: { provider: string; status: string } | null;
  baseUrl: string;
  mockMode: boolean;
};

export function ProfileClient({ slug: initialSlug, payout: initialPayout, baseUrl, mockMode }: ProfileClientProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [savedSlug, setSavedSlug] = useState(initialSlug);
  const [payout, setPayout] = useState(initialPayout);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      .then(() => setToast("คัดลอกลิงก์แล้ว"))
      .catch(() => setToast("คัดลอกไม่สำเร็จ"));
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      <Typography variant="h4">โปรไฟล์</Typography>

      <Card sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSaveSlug}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required fullWidth />
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Link
                href={`/${savedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{ minWidth: 0, wordBreak: "break-all" }}
              >
                {tipPageUrl}
              </Link>
              <IconButton
                type="button"
                size="small"
                aria-label="คัดลอกลิงก์หน้า Tip"
                onClick={copyTipPageUrl}
              >
                <Iconify icon="solar:copy-bold-duotone" />
              </IconButton>
            </Stack>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: "flex-start" }}>
              บันทึก
            </Button>
          </Stack>
        </Box>
      </Card>

      <Card sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6">ช่องทางรับเงิน</Typography>
            {mockMode && <Chip label="โหมดทดสอบ" size="small" color="warning" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            สถานะ: {payout?.status === "active" ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
          </Typography>
          <Button
            type="button"
            variant="contained"
            onClick={handleConnectPayout}
            disabled={connecting || payout?.status === "active"}
            sx={{ alignSelf: "flex-start" }}
          >
            เชื่อมต่อ Stripe
          </Button>
        </Stack>
      </Card>

      <Snackbar open={Boolean(toast)} autoHideDuration={2000} onClose={() => setToast(null)} message={toast ?? ""} />
    </Stack>
  );
}
