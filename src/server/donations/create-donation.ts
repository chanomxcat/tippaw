import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppEnv, Deps } from "@/server/env";
import { charLength, maxChars } from "@/server/lib/text";
import { normalizeSlug } from "@/server/lib/slug";
import type { PaymentProvider } from "@/server/payments/types";
import { donation, payoutAccount, streamerProfile } from "@/server/db/schema";

const nonEmpty = (n: number) =>
  maxChars(n).refine((s) => charLength(s) >= 1, { message: "required" });

/** Input schema for a donation submitted from a tip page; amount bounds come from `env`. */
export function donationInputSchema(env: AppEnv) {
  const min = Number(env.MIN_DONATION_THB);
  const max = Number(env.MAX_DONATION_THB);
  return z.object({
    slug: z.string(),
    donorName: nonEmpty(50),
    message: maxChars(200).default(""),
    amountThb: z.number().int().min(min).max(max),
  });
}

export type DonationInput = z.infer<ReturnType<typeof donationInputSchema>>;

export type CreateDonationResult =
  | { ok: true; donationId: string; checkoutUrl: string }
  | { ok: false; reason: "not_found" | "not_accepting" };

/**
 * Records a pending donation for `input.slug`'s streamer, then opens a
 * checkout session with `provider`. Fails with `not_found` when the slug
 * doesn't resolve to a streamer, or `not_accepting` when their payout
 * account isn't `active` yet.
 */
export async function createDonation(
  deps: Deps,
  provider: PaymentProvider,
  input: DonationInput,
): Promise<CreateDonationResult> {
  const slug = normalizeSlug(input.slug);

  const profile = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.slug, slug),
  });
  if (!profile) {
    return { ok: false, reason: "not_found" };
  }

  const payout = await deps.db.query.payoutAccount.findFirst({
    where: eq(payoutAccount.userId, profile.userId),
  });
  if (!payout || payout.status !== "active") {
    return { ok: false, reason: "not_accepting" };
  }

  const donationId = crypto.randomUUID();
  const amountSatang = input.amountThb * 100;

  await deps.db.insert(donation).values({
    id: donationId,
    streamerId: profile.userId,
    kind: "tip",
    donorName: input.donorName,
    messageRaw: input.message,
    amountSatang,
    status: "pending",
    provider: provider.name,
    createdAt: deps.now(),
  });

  const resultUrl = `${deps.env.BETTER_AUTH_URL}/${slug}/result?d=${donationId}`;
  const checkout = await provider.createCheckout({
    donationId,
    amountSatang,
    streamerAccountId: payout.externalAccountId ?? "",
    successUrl: resultUrl,
    cancelUrl: resultUrl,
  });

  await deps.db
    .update(donation)
    .set({ providerSessionId: checkout.sessionId })
    .where(eq(donation.id, donationId));

  return { ok: true, donationId, checkoutUrl: checkout.checkoutUrl };
}
