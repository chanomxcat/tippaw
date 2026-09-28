import { eq } from "drizzle-orm";

import { payoutAccount, streamerProfile } from "@/server/db/schema";
import type { Deps } from "@/server/env";
import { validateSlug } from "@/server/lib/slug";
import type { PaymentProvider } from "@/server/payments/types";

export type UpdateSlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "slug_format" | "slug_reserved" | "slug_taken" };

/**
 * Updates the caller's slug. Changing to the caller's own current slug is a
 * no-op success (the uniqueness check excludes their own row, so it never
 * reports `slug_taken` against themselves).
 */
export async function updateSlug(deps: Deps, userId: string, raw: string): Promise<UpdateSlugResult> {
  const validated = validateSlug(raw);
  if (!validated.ok) {
    return { ok: false, reason: validated.reason === "format" ? "slug_format" : "slug_reserved" };
  }
  const slug = validated.slug;

  const existing = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.slug, slug),
  });
  if (existing && existing.userId !== userId) {
    return { ok: false, reason: "slug_taken" };
  }

  await deps.db.update(streamerProfile).set({ slug }).where(eq(streamerProfile.userId, userId));
  return { ok: true, slug };
}

export type ConnectPayoutResult = { status: "active" | "pending"; onboardingUrl?: string };

/**
 * Connects (or reconnects) the caller's payout account via `provider`.
 * Idempotent: if the caller already has an `active` account, it's returned
 * unchanged rather than calling `provider.connectAccount` again — the mock
 * provider would otherwise mint a fresh `externalAccountId` on every call.
 */
export async function connectPayout(
  deps: Deps,
  provider: PaymentProvider,
  userId: string,
): Promise<ConnectPayoutResult> {
  const existing = await deps.db.query.payoutAccount.findFirst({
    where: eq(payoutAccount.userId, userId),
  });
  if (existing?.status === "active") {
    return { status: "active" };
  }

  const { externalAccountId, onboardingUrl } = await provider.connectAccount(userId);
  const status: "active" | "pending" = onboardingUrl ? "pending" : "active";

  if (existing) {
    await deps.db
      .update(payoutAccount)
      .set({ provider: provider.name, externalAccountId, status })
      .where(eq(payoutAccount.userId, userId));
  } else {
    await deps.db.insert(payoutAccount).values({
      userId,
      provider: provider.name,
      externalAccountId,
      status,
    });
  }

  return { status, onboardingUrl };
}

export type ProfileView = { slug: string; payout: { provider: string; status: string } | null };

/** The caller's own profile: slug + payout account summary (`null` if none exists yet). */
export async function getProfile(deps: Deps, userId: string): Promise<ProfileView> {
  const profile = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.userId, userId),
  });
  const payout = await deps.db.query.payoutAccount.findFirst({
    where: eq(payoutAccount.userId, userId),
  });

  return {
    slug: profile?.slug ?? "",
    payout: payout ? { provider: payout.provider, status: payout.status } : null,
  };
}
