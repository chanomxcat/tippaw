"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff } from "lucide-react";

import { ColorField } from "@/components/ColorField";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AlertPlayer } from "@/overlay/AlertPlayer";
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
  const { show: showToast } = useToast();
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
  const [previewTick, setPreviewTick] = useState(0);

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
      showToast("บันทึกแล้ว");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestAlert() {
    setTesting(true);
    try {
      const res = await fetch("/api/overlays/alert/test", { method: "POST" });
      showToast(res.ok ? "ส่ง Alert ทดสอบแล้ว" : "ทดสอบไม่สำเร็จ", res.ok ? "success" : "error");
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
        showToast("รีเซ็ต URL แล้ว");
      } else {
        showToast("รีเซ็ตไม่สำเร็จ", "error");
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
      .then(() => showToast("คัดลอกลิงก์แล้ว"))
      .catch(() => showToast("คัดลอกไม่สำเร็จ", "error"));
  }

  const previewText = renderTemplate(messageTemplate, {
    name: PREVIEW_DONOR,
    amountSatang: PREVIEW_AMOUNT_SATANG,
    message: PREVIEW_MESSAGE,
  });

  // The same shape the overlay itself receives over the WebSocket — rendered
  // through the exact same `AlertPlayer` so the preview matches OBS 1:1.
  // `id` changes each loop so `AlertPlayer` restarts its animation; sound is
  // silenced here (`soundUrl: null`) so it doesn't replay on every loop.
  const previewEvent = {
    type: "alert" as const,
    id: `preview-${previewTick}`,
    donorName: PREVIEW_DONOR,
    amountSatang: PREVIEW_AMOUNT_SATANG,
    message: PREVIEW_MESSAGE,
    headline: previewText,
    variant: {
      textColor,
      fontFamily: variant.fontFamily,
      fontSize,
      imageUrl: imageUrl.trim() || null,
      soundUrl: null,
      animationIn,
      animationOut,
      durationMs: Math.round((Number(durationSec) || 0) * 1000) || 1000,
    },
  };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">ตั้งค่า Alert Overlay</h1>

      <div className="surface p-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Overlay URL</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="alert-overlay-url" className="label">
              <span>Overlay URL</span>
            </label>
            <div className="join w-full">
              <input
                id="alert-overlay-url"
                type={showUrl ? "text" : "password"}
                className="input join-item w-full"
                value={overlayUrl}
                readOnly
              />
              <button
                type="button"
                aria-label={showUrl ? "ซ่อน URL" : "แสดง URL"}
                onClick={() => setShowUrl((s) => !s)}
                className="btn join-item btn-square"
              >
                {showUrl ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                aria-label="คัดลอก URL"
                onClick={copyOverlayUrl}
                className="btn join-item btn-square"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
          <p className="text-base-content/60 text-sm">ใส่ใน OBS → Sources → Browser, ขนาด 800×600</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" onClick={handleTestAlert} disabled={testing}>
              ทดสอบ Alert
            </button>
            <button type="button" className="btn btn-outline btn-error" onClick={() => setResetOpen(true)}>
              รีเซ็ต URL
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-6 md:flex-row">
        <div className="surface w-full flex-[2] p-6">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="alert-min-amount" className="label">
                <span>ยอดขั้นต่ำที่จะแสดง (บาท)</span>
              </label>
              <input
                id="alert-min-amount"
                type="number"
                className="input w-full"
                value={minAmountThb}
                onChange={(e) => setMinAmountThb(e.target.value)}
                min={0}
                step={1}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="alert-message-template" className="label">
                <span>ข้อความ template</span>
              </label>
              <textarea
                id="alert-message-template"
                className="textarea w-full"
                rows={2}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                aria-describedby="alert-message-template-hint"
                maxLength={200}
                required
              />
              <span id="alert-message-template-hint" className="text-base-content/60 text-xs">
                ใช้ {"{name} {amount} {message}"} ได้
              </span>
            </div>

            <ColorField label="สีข้อความ" value={textColor} onChange={setTextColor} />

            <div className="flex flex-col gap-1">
              <span>ขนาดตัวอักษร: {fontSize}px</span>
              <input
                type="range"
                aria-label="ขนาดตัวอักษร"
                className="range"
                min={12}
                max={120}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="alert-image-url" className="label">
                <span>รูป (URL)</span>
              </label>
              <input
                id="alert-image-url"
                className="input w-full"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            {imageUrl.trim() && (
              // eslint-disable-next-line @next/next/no-img-element -- external, arbitrary streamer-supplied URL
              <img src={imageUrl.trim()} alt="ตัวอย่างรูป" className="max-h-[120px] max-w-[200px] object-contain" />
            )}

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="alert-sound-select" className="label">
                  <span>เสียง</span>
                </label>
                <select
                  id="alert-sound-select"
                  className="select w-full"
                  value={soundMode}
                  onChange={(e) => setSoundMode(e.target.value as SoundPreset | "custom")}
                >
                  {SOUND_PRESETS.map((key) => (
                    <option key={key} value={key}>
                      {SOUND_LABELS[key]}
                    </option>
                  ))}
                  <option value="custom">กำหนด URL เอง</option>
                </select>
              </div>
              {soundMode === "custom" && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="alert-custom-sound-url" className="label">
                    <span>URL เสียง</span>
                  </label>
                  <input
                    id="alert-custom-sound-url"
                    className="input w-full"
                    value={customSoundUrl}
                    onChange={(e) => setCustomSoundUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
              <button type="button" className="btn btn-ghost btn-sm self-start" onClick={handleListen}>
                ฟังเสียง
              </button>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="alert-animation-in" className="label">
                  <span>Animation เข้า</span>
                </label>
                <select
                  id="alert-animation-in"
                  className="select w-full"
                  value={animationIn}
                  onChange={(e) => setAnimationIn(e.target.value as Animation)}
                >
                  {ANIMATIONS.map((a) => (
                    <option key={a} value={a}>
                      {ANIMATION_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="alert-animation-out" className="label">
                  <span>Animation ออก</span>
                </label>
                <select
                  id="alert-animation-out"
                  className="select w-full"
                  value={animationOut}
                  onChange={(e) => setAnimationOut(e.target.value as Animation)}
                >
                  {ANIMATIONS.map((a) => (
                    <option key={a} value={a}>
                      {ANIMATION_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="alert-duration" className="label">
                <span>ระยะเวลาแสดง (วินาที)</span>
              </label>
              <input
                id="alert-duration"
                type="number"
                className="input w-full"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                min={1}
                max={60}
                step={1}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary self-start" disabled={submitting}>
              บันทึก
            </button>
          </form>
        </div>

        <div className="surface w-full flex-1 p-6">
          <h2 className="mb-4 text-sm font-semibold">ตัวอย่าง</h2>
          <div className="flex min-h-[160px] items-center justify-center overflow-hidden rounded-box bg-[#111] p-6">
            <AlertPlayer event={previewEvent} onDone={() => setPreviewTick((t) => t + 1)} />
          </div>
        </div>
      </div>

      <Modal open={resetOpen} title="รีเซ็ต Overlay URL?" onClose={() => setResetOpen(false)}>
        <p>URL เดิมจะใช้ไม่ได้ทันที</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={() => setResetOpen(false)}>
            ยกเลิก
          </button>
          <button type="button" className="btn btn-error" onClick={handleReset} disabled={resetting}>
            ยืนยันรีเซ็ต
          </button>
        </div>
      </Modal>
    </div>
  );
}
