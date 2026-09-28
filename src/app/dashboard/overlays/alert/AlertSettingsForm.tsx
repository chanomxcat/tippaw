"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { ColorField } from "@/components/ColorField";
import { resolveSoundUrl } from "@/server/alerts/build-event";
import { renderTemplate } from "@/server/alerts/render-template";
import {
  ANIMATIONS,
  SOUND_PRESETS,
  type AlertOverlaySettings,
  type AlertVariant,
  type Animation,
  type SoundPreset,
} from "@/server/alerts/schemas";
import { thbToSatang } from "@/server/lib/money";
import { Iconify } from "@/ui/minimal/components/iconify";
import { ERROR_MESSAGES } from "@/ui/error-messages";

export type AlertSettingsFormProps = {
  overlayUrl: string;
  settings: AlertOverlaySettings;
  variant: AlertVariant;
};

const ANIMATION_LABELS: Record<Animation, string> = {
  fade: "จางเข้า/จางออก",
  "slide-up": "เลื่อนขึ้น",
  "slide-down": "เลื่อนลง",
  zoom: "ซูม",
};

const SOUND_LABELS: Record<SoundPreset, string> = {
  chime: "กระดิ่ง (Chime)",
  coin: "เหรียญ (Coin)",
  pop: "ป๊อป (Pop)",
};

const PREVIEW_DONOR = "คุณผู้ใจดี";
const PREVIEW_AMOUNT_SATANG = 10000;
const PREVIEW_MESSAGE = "สู้ๆ นะ";

/** Parses a stored `soundUrl` (a `preset:<key>` or an https URL) into the form's sound-select state. */
function parseSound(soundUrl: string | null): { mode: SoundPreset | "custom"; custom: string } {
  if (soundUrl?.startsWith("preset:")) {
    const key = soundUrl.slice("preset:".length);
    if ((SOUND_PRESETS as readonly string[]).includes(key)) {
      return { mode: key as SoundPreset, custom: "" };
    }
  }
  if (soundUrl) return { mode: "custom", custom: soundUrl };
  return { mode: "chime", custom: "" };
}

export function AlertSettingsForm({
  overlayUrl: initialOverlayUrl,
  settings,
  variant,
}: AlertSettingsFormProps) {
  const router = useRouter();
  const initialSound = parseSound(variant.soundUrl);

  const [overlayUrl, setOverlayUrl] = useState(initialOverlayUrl);
  const [showUrl, setShowUrl] = useState(false);
  const [minAmountThb, setMinAmountThb] = useState(String(settings.minAmountSatang / 100));
  const [messageTemplate, setMessageTemplate] = useState(variant.messageTemplate);
  const [textColor, setTextColor] = useState(variant.textColor);
  const [fontSize, setFontSize] = useState(variant.fontSize);
  const [imageUrl, setImageUrl] = useState(variant.imageUrl ?? "");
  const [soundMode, setSoundMode] = useState<SoundPreset | "custom">(initialSound.mode);
  const [customSoundUrl, setCustomSoundUrl] = useState(initialSound.custom);
  const [animationIn, setAnimationIn] = useState<Animation>(variant.animationIn);
  const [animationOut, setAnimationOut] = useState<Animation>(variant.animationOut);
  const [durationSec, setDurationSec] = useState(String(variant.durationMs / 1000));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const currentSoundUrl = soundMode === "custom" ? customSoundUrl.trim() || null : `preset:${soundMode}`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        settings: { minAmountSatang: thbToSatang(Number(minAmountThb) || 0) },
        variant: {
          name: variant.name,
          minAmountSatang: variant.minAmountSatang,
          weight: variant.weight,
          messageTemplate,
          textColor,
          fontFamily: variant.fontFamily,
          fontSize,
          imageUrl: imageUrl.trim() || null,
          soundUrl: currentSoundUrl,
          animationIn,
          animationOut,
          durationMs: Math.round((Number(durationSec) || 0) * 1000),
        },
      };
      const res = await fetch("/api/overlays/alert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[errBody?.error ?? ""] ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setToast("บันทึกแล้ว");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestAlert() {
    setTesting(true);
    try {
      const res = await fetch("/api/overlays/alert/test", { method: "POST" });
      setToast(res.ok ? "ส่ง Alert ทดสอบแล้ว" : "ทดสอบไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/overlays/alert/reset", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { overlayUrl: string };
        setOverlayUrl(data.overlayUrl);
        setToast("รีเซ็ต URL แล้ว");
      } else {
        setToast("รีเซ็ตไม่สำเร็จ");
      }
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  }

  function handleListen() {
    const url = resolveSoundUrl(currentSoundUrl);
    if (!url) return;
    new Audio(url).play().catch(() => {});
  }

  function copyOverlayUrl() {
    navigator.clipboard
      ?.writeText(overlayUrl)
      .then(() => setToast("คัดลอกลิงก์แล้ว"))
      .catch(() => setToast("คัดลอกไม่สำเร็จ"));
  }

  const previewText = renderTemplate(messageTemplate, {
    name: PREVIEW_DONOR,
    amountSatang: PREVIEW_AMOUNT_SATANG,
    message: PREVIEW_MESSAGE,
  });

  return (
    <Stack spacing={3} sx={{ maxWidth: 960 }}>
      <Typography variant="h4">ตั้งค่า Alert Overlay</Typography>

      <Card sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Overlay URL</Typography>
          <TextField
            label="Overlay URL"
            type={showUrl ? "text" : "password"}
            value={overlayUrl}
            fullWidth
            slotProps={{
              htmlInput: { readOnly: true },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      size="small"
                      aria-label={showUrl ? "ซ่อน URL" : "แสดง URL"}
                      onClick={() => setShowUrl((s) => !s)}
                    >
                      <Iconify icon={showUrl ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} />
                    </IconButton>
                    <IconButton
                      type="button"
                      size="small"
                      aria-label="คัดลอก URL"
                      onClick={copyOverlayUrl}
                    >
                      <Iconify icon="solar:copy-bold-duotone" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Typography variant="body2" color="text.secondary">
            ใส่ใน OBS → Sources → Browser, ขนาด 800×600
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button type="button" variant="outlined" onClick={handleTestAlert} disabled={testing}>
              ทดสอบ Alert
            </Button>
            <Button type="button" variant="outlined" color="error" onClick={() => setResetOpen(true)}>
              รีเซ็ต URL
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        <Card sx={{ p: 3, flex: 2, width: "100%" }}>
          <Box component="form" onSubmit={handleSave}>
            <Stack spacing={2.5}>
              {error && <Alert severity="error">{error}</Alert>}

              <TextField
                label="ยอดขั้นต่ำที่จะแสดง (บาท)"
                type="number"
                value={minAmountThb}
                onChange={(e) => setMinAmountThb(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                required
              />

              <TextField
                label="ข้อความ template"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                helperText="ใช้ {name} {amount} {message} ได้"
                slotProps={{ htmlInput: { maxLength: 200 } }}
                multiline
                minRows={2}
                required
                fullWidth
              />

              <ColorField label="สีข้อความ" value={textColor} onChange={setTextColor} />

              <Stack spacing={1}>
                <Typography variant="body2">ขนาดตัวอักษร: {fontSize}px</Typography>
                <Slider
                  value={fontSize}
                  onChange={(_e, v) => setFontSize(v as number)}
                  min={12}
                  max={120}
                  valueLabelDisplay="auto"
                  aria-label="ขนาดตัวอักษร"
                />
              </Stack>

              <TextField
                label="รูป (URL)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                fullWidth
              />
              {imageUrl.trim() && (
                // eslint-disable-next-line @next/next/no-img-element -- external, arbitrary streamer-supplied URL
                <img
                  src={imageUrl.trim()}
                  alt="ตัวอย่างรูป"
                  style={{ maxWidth: 200, maxHeight: 120, objectFit: "contain" }}
                />
              )}

              <Stack spacing={1}>
                <TextField
                  select
                  label="เสียง"
                  value={soundMode}
                  onChange={(e) => setSoundMode(e.target.value as SoundPreset | "custom")}
                >
                  {SOUND_PRESETS.map((key) => (
                    <MenuItem key={key} value={key}>
                      {SOUND_LABELS[key]}
                    </MenuItem>
                  ))}
                  <MenuItem value="custom">กำหนด URL เอง</MenuItem>
                </TextField>
                {soundMode === "custom" && (
                  <TextField
                    label="URL เสียง"
                    value={customSoundUrl}
                    onChange={(e) => setCustomSoundUrl(e.target.value)}
                    placeholder="https://..."
                    fullWidth
                  />
                )}
                <Button type="button" variant="text" onClick={handleListen} sx={{ alignSelf: "flex-start" }}>
                  ฟังเสียง
                </Button>
              </Stack>

              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="Animation เข้า"
                  value={animationIn}
                  onChange={(e) => setAnimationIn(e.target.value as Animation)}
                  sx={{ flex: 1 }}
                >
                  {ANIMATIONS.map((a) => (
                    <MenuItem key={a} value={a}>
                      {ANIMATION_LABELS[a]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Animation ออก"
                  value={animationOut}
                  onChange={(e) => setAnimationOut(e.target.value as Animation)}
                  sx={{ flex: 1 }}
                >
                  {ANIMATIONS.map((a) => (
                    <MenuItem key={a} value={a}>
                      {ANIMATION_LABELS[a]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <TextField
                label="ระยะเวลาแสดง (วินาที)"
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 60, step: 1 } }}
                required
              />

              <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: "flex-start" }}>
                บันทึก
              </Button>
            </Stack>
          </Box>
        </Card>

        <Card sx={{ p: 3, flex: 1, width: "100%" }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            ตัวอย่าง
          </Typography>
          <Box sx={{ bgcolor: "#111", borderRadius: 1, p: 3, textAlign: "center" }}>
            <Typography
              sx={{
                color: textColor,
                fontSize: `${fontSize}px`,
                fontFamily: "Prompt, sans-serif",
                wordBreak: "break-word",
              }}
            >
              {previewText}
            </Typography>
          </Box>
        </Card>
      </Stack>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>รีเซ็ต Overlay URL?</DialogTitle>
        <DialogContent>
          <DialogContentText>URL เดิมจะใช้ไม่ได้ทันที</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setResetOpen(false)}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleReset} color="error" disabled={resetting}>
            ยืนยันรีเซ็ต
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={2000} onClose={() => setToast(null)} message={toast ?? ""} />
    </Stack>
  );
}
