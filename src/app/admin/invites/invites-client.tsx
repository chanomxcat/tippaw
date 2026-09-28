"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { Iconify } from "@/ui/minimal/components/iconify";
import { inviteStatusLabel } from "@/server/admin/invite-status";

export type InviteViewRow = {
  code: string;
  note: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  disabledAt: string | null;
  createdAt: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "ข้อมูลไม่ถูกต้อง",
  invalid_code: "รูปแบบโค้ดไม่ถูกต้อง (A-Z, 0-9, - ความยาว 4-32 ตัว)",
  duplicate: "โค้ดนี้มีอยู่แล้ว",
  expires_in_past: "วันหมดอายุต้องอยู่ในอนาคต",
  generate_failed: "สร้างโค้ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "-";
}

export function InvitesClient({ initialInvites }: { initialInvites: InviteViewRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [quota, setQuota] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function resetForm() {
    setMode("random");
    setCode("");
    setNote("");
    setQuota("");
    setExpiresAt("");
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: mode === "custom" ? code : undefined,
          note: note.trim() ? note.trim() : undefined,
          maxUses: quota.trim() ? Number(quota) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_MESSAGES[body?.error ?? ""] ?? "สร้างโค้ดไม่สำเร็จ");
        return;
      }
      setDialogOpen(false);
      resetForm();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDisabled(inviteCode: string, disabled: boolean) {
    setPendingCode(inviteCode);
    try {
      await fetch(`/api/admin/invites/${encodeURIComponent(inviteCode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      router.refresh();
    } finally {
      setPendingCode(null);
    }
  }

  function copyText(text: string, message: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setToast(message))
      .catch(() => setToast("คัดลอกไม่สำเร็จ"));
  }

  const now = new Date();

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4">Invite codes</Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          สร้างโค้ด
        </Button>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>โค้ด</TableCell>
                <TableCell>หมายเหตุ</TableCell>
                <TableCell>ใช้แล้ว/โควตา</TableCell>
                <TableCell>หมดอายุ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell>สร้างเมื่อ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {initialInvites.map((invite) => {
                const status = inviteStatusLabel(
                  {
                    disabledAt: invite.disabledAt ? new Date(invite.disabledAt) : null,
                    expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : null,
                    maxUses: invite.maxUses,
                    usedCount: invite.usedCount,
                  },
                  now,
                );
                const disabled = Boolean(invite.disabledAt);
                const registerLink = `/register?code=${invite.code}`;

                return (
                  <TableRow key={invite.code}>
                    <TableCell>
                      <Link component={NextLink} href={`/admin/invites/${invite.code}`}>
                        {invite.code}
                      </Link>
                    </TableCell>
                    <TableCell>{invite.note ?? "-"}</TableCell>
                    <TableCell>{`${invite.usedCount} / ${invite.maxUses ?? "∞"}`}</TableCell>
                    <TableCell>{formatDate(invite.expiresAt)}</TableCell>
                    <TableCell>{status}</TableCell>
                    <TableCell>{formatDate(invite.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={`คัดลอกโค้ด ${invite.code}`}
                        onClick={() => copyText(invite.code, "คัดลอกโค้ดแล้ว")}
                      >
                        <Iconify icon="solar:copy-bold-duotone" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`คัดลอกลิงก์ ${invite.code}`}
                        onClick={() =>
                          copyText(`${window.location.origin}${registerLink}`, "คัดลอกลิงก์แล้ว")
                        }
                      >
                        <Iconify icon="solar:link-bold-duotone" />
                      </IconButton>
                      <Switch
                        checked={!disabled}
                        disabled={pendingCode === invite.code}
                        onChange={(e) => toggleDisabled(invite.code, !e.target.checked)}
                        slotProps={{ input: { "aria-label": `เปิด/ปิดใช้งาน ${invite.code}` } }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleCreate}>
          <DialogTitle>สร้างโค้ด</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <RadioGroup
                row
                value={mode}
                onChange={(e) => setMode(e.target.value as "random" | "custom")}
              >
                <FormControlLabel value="random" control={<Radio />} label="สุ่ม" />
                <FormControlLabel value="custom" control={<Radio />} label="กำหนดเอง" />
              </RadioGroup>
              {mode === "custom" && (
                <TextField
                  label="โค้ด"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  fullWidth
                />
              )}
              <TextField
                label="หมายเหตุ"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                fullWidth
              />
              <TextField
                label="โควตา"
                type="number"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                helperText="เว้นว่างสำหรับไม่จำกัด"
                slotProps={{ htmlInput: { min: 1, max: 10000 } }}
                fullWidth
              />
              <TextField
                label="วันหมดอายุ"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                helperText="เว้นว่างสำหรับไม่มีวันหมดอายุ"
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              สร้าง
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Stack>
  );
}
