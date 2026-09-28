import { eq } from "drizzle-orm";
import { z } from "zod";

import { payoutAccount, streamerProfile, tipPage } from "@/server/db/schema";
import type { Deps } from "@/server/env";
import { normalizeSlug } from "@/server/lib/slug";
import { charLength, maxChars } from "@/server/lib/text";

const nonEmpty = (n: number) =>
  maxChars(n).refine((s) => charLength(s) >= 1, { message: "required" });

/** True for an `https://` URL that parses as valid; used to gate user-supplied link URLs. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const httpsUrlSchema = z.string().refine(isHttpsUrl, {
  message: "must be an https:// URL",
});

const linkSchema = z.object({
  label: nonEmpty(30),
  url: httpsUrlSchema,
});

/** Input schema for `PUT /api/tip-page`. */
export const tipPageUpdateSchema = z.object({
  channelName: nonEmpty(50),
  links: z.array(linkSchema).max(10),
  successMessage: nonEmpty(300),
  failureMessage: nonEmpty(300),
});

export type TipPageInput = z.infer<typeof tipPageUpdateSchema>;

export type TipPageView = {
  channelName: string;
  links: { label: string; url: string }[];
  successMessage: string;
  failureMessage: string;
};

/** The caller's own tip page settings, or `null` if they have none (shouldn't happen once onboarded). */
export async function getTipPage(deps: Deps, userId: string): Promise<TipPageView | null> {
  const row = await deps.db.query.tipPage.findFirst({ where: eq(tipPage.userId, userId) });
  if (!row) return null;

  return {
    channelName: row.channelName,
    links: row.links,
    successMessage: row.successMessage ?? "",
    failureMessage: row.failureMessage ?? "",
  };
}

/** Overwrites the caller's tip page settings with validated `input`. */
export async function updateTipPage(deps: Deps, userId: string, input: TipPageInput): Promise<void> {
  await deps.db
    .update(tipPage)
    .set({
      channelName: input.channelName,
      links: input.links,
      successMessage: input.successMessage,
      failureMessage: input.failureMessage,
    })
    .where(eq(tipPage.userId, userId));
}

export type PublicTipPage = {
  streamerId: string;
  slug: string;
  channelName: string;
  links: { label: string; url: string }[];
  successMessage: string;
  failureMessage: string;
  accepting: boolean;
};

/**
 * The public-facing tip page for `rawSlug` (normalized before lookup), or
 * `null` when no streamer has that slug or their tip page row is missing.
 * `accepting` reflects whether their payout account is `active` — the
 * public page (Task 14) uses it to gate the donation form.
 */
export async function getPublicTipPage(deps: Deps, rawSlug: string): Promise<PublicTipPage | null> {
  const slug = normalizeSlug(rawSlug);

  const profile = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.slug, slug),
  });
  if (!profile) return null;

  const page = await deps.db.query.tipPage.findFirst({
    where: eq(tipPage.userId, profile.userId),
  });
  if (!page) return null;

  const payout = await deps.db.query.payoutAccount.findFirst({
    where: eq(payoutAccount.userId, profile.userId),
  });

  return {
    streamerId: profile.userId,
    slug: profile.slug,
    channelName: page.channelName,
    links: page.links,
    successMessage: page.successMessage ?? "",
    failureMessage: page.failureMessage ?? "",
    accepting: payout?.status === "active",
  };
}
