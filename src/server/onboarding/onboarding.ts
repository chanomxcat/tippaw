import { eq } from "drizzle-orm";

import { DEFAULT_ALERT_SETTINGS, DEFAULT_ALERT_VARIANT } from "@/server/alerts/schemas";
import type { SessionUser } from "@/server/auth/session";
import { alertVariant, overlay, streamerProfile, tipPage } from "@/server/db/schema";
import type { Deps } from "@/server/env";
import { hasRedeemed, redeemInvite } from "@/server/invites/invites";
import { randomToken } from "@/server/lib/random";
import { validateSlug } from "@/server/lib/slug";

const SUCCESS_MESSAGE = "ขอบคุณสำหรับการสนับสนุนนะ 💜";
const FAILURE_MESSAGE = "การชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะ";

export type OnboardingState = { needsInvite: boolean; needsSlug: boolean };

/** Whether `user` still needs to redeem an invite and/or pick a slug before reaching the dashboard. */
export async function getOnboardingState(deps: Deps, user: SessionUser): Promise<OnboardingState> {
  const [profile] = await deps.db
    .select({ userId: streamerProfile.userId })
    .from(streamerProfile)
    .where(eq(streamerProfile.userId, user.id))
    .limit(1);

  const needsInvite = user.role !== "admin" && !(await hasRedeemed(deps, user.id));
  const needsSlug = !profile;

  return { needsInvite, needsSlug };
}

export type CompleteOnboardingInput = { inviteCode?: string; slug: string };

export type CompleteOnboardingResult =
  | { ok: true }
  | { ok: false; reason: "invite_invalid" | "slug_format" | "slug_reserved" | "slug_taken" };

/**
 * Finishes onboarding for `user`: redeems the invite code (unless already
 * redeemed or the user is an admin) and validates the slug, then creates
 * the streamer's `streamer_profile`, `tip_page`, default `alert` overlay,
 * and its default `alert_variant` in one batch.
 *
 * The invite is redeemed *first*, via `redeemInvite` directly (which is
 * atomic against concurrent redeemers of the same single-use code) rather
 * than a `checkInvite` + later `redeemInvite` — that check-then-act gap let
 * two concurrent submissions both pass validation and both try to create a
 * profile, with only one invite redemption actually landing. If a user
 * already has a profile (e.g. they won that profile-creation race on an
 * earlier call, or this is a retried submission), this is idempotent: it
 * skips slug validation/insertion entirely and returns `ok` without
 * touching their existing profile.
 */
export async function completeOnboarding(
  deps: Deps,
  user: SessionUser,
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const alreadyRedeemed = user.role === "admin" || (await hasRedeemed(deps, user.id));
  if (!alreadyRedeemed) {
    if (!input.inviteCode) {
      return { ok: false, reason: "invite_invalid" };
    }
    const redeemed = await redeemInvite(deps, user.id, input.inviteCode);
    if (!redeemed) {
      return { ok: false, reason: "invite_invalid" };
    }
  }

  const existingProfile = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.userId, user.id),
  });
  if (existingProfile) {
    return { ok: true };
  }

  const slugResult = validateSlug(input.slug);
  if (!slugResult.ok) {
    return { ok: false, reason: slugResult.reason === "format" ? "slug_format" : "slug_reserved" };
  }
  const slug = slugResult.slug;

  const existingSlug = await deps.db.query.streamerProfile.findFirst({
    where: eq(streamerProfile.slug, slug),
  });
  if (existingSlug) {
    return { ok: false, reason: "slug_taken" };
  }

  const now = deps.now();

  await deps.db.batch([
    deps.db.insert(streamerProfile).values({ userId: user.id, slug, createdAt: now }),
    deps.db.insert(tipPage).values({
      userId: user.id,
      channelName: user.name,
      links: [],
      successMessage: SUCCESS_MESSAGE,
      failureMessage: FAILURE_MESSAGE,
    }),
    deps.db.insert(overlay).values({
      id: crypto.randomUUID(),
      streamerId: user.id,
      type: "alert",
      token: randomToken(),
      settings: DEFAULT_ALERT_SETTINGS,
      updatedAt: now,
    }),
    deps.db.insert(alertVariant).values({
      id: crypto.randomUUID(),
      streamerId: user.id,
      name: DEFAULT_ALERT_VARIANT.name,
      minAmountSatang: DEFAULT_ALERT_VARIANT.minAmountSatang,
      weight: DEFAULT_ALERT_VARIANT.weight,
      messageTemplate: DEFAULT_ALERT_VARIANT.messageTemplate,
      textColor: DEFAULT_ALERT_VARIANT.textColor,
      fontFamily: DEFAULT_ALERT_VARIANT.fontFamily,
      fontSize: DEFAULT_ALERT_VARIANT.fontSize,
      imageUrl: DEFAULT_ALERT_VARIANT.imageUrl,
      soundUrl: DEFAULT_ALERT_VARIANT.soundUrl,
      animationIn: DEFAULT_ALERT_VARIANT.animationIn,
      animationOut: DEFAULT_ALERT_VARIANT.animationOut,
      durationMs: DEFAULT_ALERT_VARIANT.durationMs,
      ttsEnabled: false,
      ttsVoice: null,
      sortOrder: 0,
    }),
  ]);

  return { ok: true };
}
