import { notFound } from "next/navigation";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { getDonationBySession } from "@/server/donations/queries";
import { getDeps, isMockMode } from "@/server/env";

import { CheckoutActions } from "./CheckoutActions";

type Params = Promise<{ sessionId: string }>;

/** Inline SVG placeholder QR code — no external QR library needed for the mock checkout page. */
function QrPlaceholder() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="QR ตัวอย่าง">
      <rect width="160" height="160" fill="#ffffff" />
      <rect x="8" y="8" width="40" height="40" fill="#000000" />
      <rect x="112" y="8" width="40" height="40" fill="#000000" />
      <rect x="8" y="112" width="40" height="40" fill="#000000" />
      <rect x="20" y="20" width="16" height="16" fill="#ffffff" />
      <rect x="124" y="20" width="16" height="16" fill="#ffffff" />
      <rect x="20" y="124" width="16" height="16" fill="#ffffff" />
      <rect x="64" y="16" width="8" height="8" fill="#000000" />
      <rect x="80" y="16" width="8" height="8" fill="#000000" />
      <rect x="64" y="32" width="8" height="8" fill="#000000" />
      <rect x="96" y="48" width="8" height="8" fill="#000000" />
      <rect x="64" y="64" width="8" height="8" fill="#000000" />
      <rect x="80" y="64" width="8" height="8" fill="#000000" />
      <rect x="96" y="64" width="8" height="8" fill="#000000" />
      <rect x="112" y="64" width="8" height="8" fill="#000000" />
      <rect x="64" y="80" width="8" height="8" fill="#000000" />
      <rect x="96" y="96" width="8" height="8" fill="#000000" />
      <rect x="112" y="96" width="8" height="8" fill="#000000" />
      <rect x="64" y="112" width="8" height="8" fill="#000000" />
      <rect x="80" y="128" width="8" height="8" fill="#000000" />
      <rect x="112" y="128" width="8" height="8" fill="#000000" />
      <rect x="96" y="144" width="8" height="8" fill="#000000" />
    </svg>
  );
}

export default async function MockCheckoutPage({ params }: { params: Params }) {
  const { sessionId } = await params;
  const deps = await getDeps();
  if (!isMockMode(deps.env)) notFound();

  const donationRow = await getDonationBySession(deps, sessionId);
  if (!donationRow) notFound();

  const amountThb = donationRow.amountSatang / 100;

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Stack spacing={3} sx={{ alignItems: "center" }}>
          <Chip label="โหมดทดสอบ — ไม่มีการตัดเงินจริง" color="warning" />
          <Typography variant="h6">{donationRow.channelName}</Typography>
          <Box>
            <QrPlaceholder />
          </Box>
          <Typography variant="h4">{amountThb.toLocaleString("th-TH")} บาท</Typography>
          <CheckoutActions sessionId={sessionId} />
        </Stack>
      </Card>
    </Container>
  );
}
