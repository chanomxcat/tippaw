"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { Iconify } from "@/ui/minimal/components/iconify";
import { ERROR_MESSAGES } from "@/ui/error-messages";

export type TipLink = { label: string; url: string };

export type TipPageClientProps = {
  slug: string;
  channelName: string;
  links: TipLink[];
  successMessage: string;
  failureMessage: string;
};

const MAX_LINKS = 10;

export function TipPageClient({
  slug,
  channelName: initialChannelName,
  links: initialLinks,
  successMessage: initialSuccess,
  failureMessage: initialFailure,
}: TipPageClientProps) {
  const router = useRouter();
  const [channelName, setChannelName] = useState(initialChannelName);
  const [links, setLinks] = useState<TipLink[]>(initialLinks);
  const [successMessage, setSuccessMessage] = useState(initialSuccess);
  const [failureMessage, setFailureMessage] = useState(initialFailure);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks([...links, { label: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks(links.filter((_, i) => i !== index));
  }

  function moveLink(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setLinks(next);
  }

  function updateLink(index: number, field: "label" | "url", value: string) {
    setLinks(links.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tip-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName, links, successMessage, failureMessage }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[body?.error ?? ""] ?? "บันทึกไม่สำเร็จ");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4">ตั้งค่าหน้า Tip</Typography>
        <Link href={`/${slug}`} target="_blank" rel="noopener noreferrer" underline="hover">
          ดูหน้า Tip
        </Link>
      </Stack>

      <Card sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSave}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="ชื่อช่อง"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 50 } }}
              required
              fullWidth
            />

            <Stack spacing={1}>
              <Typography variant="subtitle2">ลิงก์</Typography>
              {links.map((link, index) => (
                <Stack key={index} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    label="ชื่อลิงก์"
                    value={link.label}
                    onChange={(e) => updateLink(index, "label", e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 30 } }}
                    size="small"
                  />
                  <TextField
                    label="URL"
                    value={link.url}
                    onChange={(e) => updateLink(index, "url", e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <IconButton
                    type="button"
                    size="small"
                    aria-label="เลื่อนขึ้น"
                    onClick={() => moveLink(index, -1)}
                    disabled={index === 0}
                  >
                    <Iconify icon="solar:alt-arrow-up-bold-duotone" />
                  </IconButton>
                  <IconButton
                    type="button"
                    size="small"
                    aria-label="เลื่อนลง"
                    onClick={() => moveLink(index, 1)}
                    disabled={index === links.length - 1}
                  >
                    <Iconify icon="solar:alt-arrow-down-bold-duotone" />
                  </IconButton>
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={`ลบลิงก์ ${index + 1}`}
                    onClick={() => removeLink(index)}
                  >
                    <Iconify icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={addLink}
                disabled={links.length >= MAX_LINKS}
                sx={{ alignSelf: "flex-start" }}
              >
                เพิ่มลิงก์
              </Button>
            </Stack>

            <TextField
              label="ข้อความสำเร็จ"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 300 } }}
              multiline
              minRows={2}
              required
              fullWidth
            />
            <TextField
              label="ข้อความไม่สำเร็จ"
              value={failureMessage}
              onChange={(e) => setFailureMessage(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 300 } }}
              multiline
              minRows={2}
              required
              fullWidth
            />

            <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: "flex-start" }}>
              บันทึก
            </Button>
          </Stack>
        </Box>
      </Card>
    </Stack>
  );
}
