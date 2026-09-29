import { notFound } from "next/navigation";

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
    <div className="mx-auto max-w-xs py-8">
      <div className="card bg-base-100 shadow p-8 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="badge badge-warning">โหมดทดสอบ — ไม่มีการตัดเงินจริง</div>
          <h2 className="text-xl font-medium">{donationRow.channelName}</h2>
          <div>
            <QrPlaceholder />
          </div>
          <p className="text-3xl font-medium">{amountThb.toLocaleString("th-TH")} บาท</p>
          <CheckoutActions sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}
