"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

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
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">ตั้งค่าหน้า Tip</h1>
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="link link-hover">
          ดูหน้า Tip
        </a>
      </div>

      <div className="surface p-6">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="tip-page-channel-name" className="label">
              <span>ชื่อช่อง</span>
            </label>
            <input
              id="tip-page-channel-name"
              className="input w-full"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              maxLength={50}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="label">ลิงก์</span>
            {links.map((link, index) => (
              <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  aria-label="ชื่อลิงก์"
                  placeholder="ชื่อลิงก์"
                  className="input input-sm w-full sm:w-40"
                  value={link.label}
                  onChange={(e) => updateLink(index, "label", e.target.value)}
                  maxLength={30}
                />
                <input
                  aria-label="URL"
                  placeholder="URL"
                  className="input input-sm w-full"
                  value={link.url}
                  onChange={(e) => updateLink(index, "url", e.target.value)}
                />
                <div className="flex justify-end gap-1 sm:justify-start">
                  <button
                    type="button"
                    aria-label="เลื่อนขึ้น"
                    onClick={() => moveLink(index, -1)}
                    disabled={index === 0}
                    className="btn btn-ghost btn-square btn-sm"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="เลื่อนลง"
                    onClick={() => moveLink(index, 1)}
                    disabled={index === links.length - 1}
                    className="btn btn-ghost btn-square btn-sm"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`ลบลิงก์ ${index + 1}`}
                    onClick={() => removeLink(index)}
                    className="btn btn-ghost btn-square btn-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addLink}
              disabled={links.length >= MAX_LINKS}
              className="btn btn-outline btn-sm self-start"
            >
              เพิ่มลิงก์
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tip-page-success-message" className="label">
              <span>ข้อความสำเร็จ</span>
            </label>
            <textarea
              id="tip-page-success-message"
              className="textarea w-full"
              rows={2}
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              maxLength={300}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tip-page-failure-message" className="label">
              <span>ข้อความไม่สำเร็จ</span>
            </label>
            <textarea
              id="tip-page-failure-message"
              className="textarea w-full"
              rows={2}
              value={failureMessage}
              onChange={(e) => setFailureMessage(e.target.value)}
              maxLength={300}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary self-start" disabled={submitting}>
            บันทึก
          </button>
        </form>
      </div>
    </div>
  );
}
