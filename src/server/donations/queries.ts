import { and, desc, eq, sql } from "drizzle-orm";

import { donation, streamerProfile, tipPage } from "@/server/db/schema";
import type { Deps } from "@/server/env";

export const PAGE_SIZE = 50;

export type DonationStatus = {
  status: "pending" | "paid" | "failed";
  slug: string;
};

/** Looks up a donation's status and its streamer's slug, for the donor-facing result page. */
export async function getDonationStatus(
  deps: Deps,
  donationId: string,
): Promise<DonationStatus | null> {
  const row = await deps.db.query.donation.findFirst({
    where: eq(donation.id, donationId),
  });
  if (!row) return null;

  const profile = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.userId, row.streamerId),
  });
  if (!profile) return null;

  return { status: row.status, slug: profile.slug };
}

export type DonationBySession = {
  id: string;
  amountSatang: number;
  status: "pending" | "paid" | "failed";
  channelName: string;
};

/** Looks up a donation by its provider session id, with its streamer's channel name, for the mock checkout page. */
export async function getDonationBySession(
  deps: Deps,
  sessionId: string,
): Promise<DonationBySession | null> {
  const row = await deps.db.query.donation.findFirst({
    where: eq(donation.providerSessionId, sessionId),
  });
  if (!row) return null;

  const page = await deps.db.query.tipPage.findFirst({
    where: eq(tipPage.userId, row.streamerId),
  });
  if (!page) return null;

  return {
    id: row.id,
    amountSatang: row.amountSatang,
    status: row.status,
    channelName: page.channelName,
  };
}

export type PaidDonationItem = {
  id: string;
  paidAt: Date;
  donorName: string;
  amountSatang: number;
  message: string;
};

export type ListPaidDonationsResult = {
  items: PaidDonationItem[];
  total: number;
};

/**
 * Lists a streamer's `paid` donations, newest first (ties broken by `id`
 * descending for a stable order across pages), `PAGE_SIZE` (50) per page.
 * `page` is 1-indexed; a non-integer or non-positive `page` is treated as 1.
 */
export async function listPaidDonations(
  deps: Deps,
  streamerId: string,
  page: number,
): Promise<ListPaidDonationsResult> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const where = and(eq(donation.streamerId, streamerId), eq(donation.status, "paid"));

  const rows = await deps.db
    .select()
    .from(donation)
    .where(where)
    .orderBy(desc(donation.paidAt), desc(donation.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const countRows = await deps.db
    .select({ count: sql<number>`count(*)` })
    .from(donation)
    .where(where);
  const count = countRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      paidAt: row.paidAt as Date,
      donorName: row.donorName,
      amountSatang: row.amountSatang,
      message: row.messageRaw ?? "",
    })),
    total: count,
  };
}
