"use client";

import { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { ERROR_MESSAGES } from "@/ui/error-messages";
import { useHydrated } from "@/ui/use-hydrated";

const DONOR_NAME_KEY = "tippaw:donorName";
const MESSAGE_MAX_CHARS = 200;
const QUICK_AMOUNTS = [20, 50, 100, 500];

export type TipFormProps = {
  slug: string;
  minThb: number;
  maxThb: number;
};

function charLength(s: string): number {
  return [...s].length;
}

export function TipForm({ slug, minThb, maxThb }: TipFormProps) {
  const hydrated = useHydrated();
  const [donorName, setDonorName] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DONOR_NAME_KEY);
      if (saved) {
        setDonorName(saved);
        setRemember(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — carry on without it.
    }
  }, []);

  function handleRememberChange(checked: boolean) {
    setRemember(checked);
    try {
      if (checked) {
        window.localStorage.setItem(DONOR_NAME_KEY, donorName);
      } else {
        window.localStorage.removeItem(DONOR_NAME_KEY);
      }
    } catch {
      // ignore
    }
  }

  function handleDonorNameChange(value: string) {
    setDonorName(value);
    if (remember) {
      try {
        window.localStorage.setItem(DONOR_NAME_KEY, value);
      } catch {
        // ignore
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountThb = Number(amountInput);
    if (!Number.isInteger(amountThb) || amountThb < minThb || amountThb > maxThb) {
      setError(`จำนวนเงินต้องเป็นจำนวนเต็มระหว่าง ${minThb}-${maxThb} บาท`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, donorName, message, amountThb }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[body?.error ?? ""] ?? "ส่งข้อมูลไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { checkoutUrl: string };
      // Leave `submitting` true (no `finally` resetting it) — we're about
      // to navigate away with a full page load, and re-enabling the button
      // for the moment before that happens would invite a double submit.
      window.location.href = data.checkoutUrl;
    } catch {
      // The fetch itself rejected (network error, etc.) rather than
      // resolving with a non-ok response — same generic message.
      setError("ส่งข้อมูลไม่สำเร็จ");
      setSubmitting(false);
    }
  }

  return (
    <Card sx={{ p: 4 }}>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="ชื่อของคุณ"
            value={donorName}
            onChange={(e) => handleDonorNameChange(e.target.value)}
            required
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => handleRememberChange(e.target.checked)}
              />
            }
            label="จดจำชื่อ"
          />

          <TextField
            label="ข้อความถึงสตรีมเมอร์"
            value={message}
            onChange={(e) => {
              const value = e.target.value;
              if (charLength(value) <= MESSAGE_MAX_CHARS) setMessage(value);
            }}
            helperText={`${charLength(message)}/${MESSAGE_MAX_CHARS}`}
            multiline
            minRows={2}
            fullWidth
          />

          <TextField
            label="จำนวนเงิน (บาท)"
            type="number"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            helperText={`ขั้นต่ำ ${minThb} บาท สูงสุด ${maxThb} บาท`}
            required
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setAmountInput(String(amount))}
              >
                {amount}
              </Button>
            ))}
          </Stack>

          {/*
            Disabled until hydrated (see use-hydrated.ts): this form has no
            `action`, so a native submit before React's onSubmit is wired up
            would fall back to the browser default — a GET to the current
            URL that reloads the page and discards whatever the donor
            typed. Disabling the only submit button also fully prevents an
            implicit Enter-key submission here (per the HTML spec, that
            only fires with no disabled default button *and* — separately —
            exactly one non-button field; this form has three: name,
            message, amount), so no extra `method`/`action` workaround is
            needed once the button itself is gated.
          */}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!hydrated || submitting}
            fullWidth
          >
            ชำระเงิน
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}
