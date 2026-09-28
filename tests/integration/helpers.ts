import { createAuth, placeholderEmail } from "@/server/auth/auth";
import { createDb } from "@/server/db/client";
import { alertVariant, overlay, payoutAccount, streamerProfile, tipPage } from "@/server/db/schema";
import { user } from "@/server/db/auth-schema";
import { DEFAULT_ALERT_SETTINGS } from "@/server/alerts/schemas";
import type { Deps } from "@/server/env";

function randomId() {
  return crypto.randomUUID();
}

/** A short unique name, prefixed for readability in test failures (e.g. usernames, slugs). */
export function uniqueName(prefix: string): string {
  return `${prefix}${randomId().replace(/-/g, "").slice(0, 8)}`;
}

/** Merges `Set-Cookie` response headers into a `cookie` header value, for use on the next request. */
export function cookieHeader(res: Headers, previous = ""): string {
  const jar = new Map<string, string>();
  const put = (pair: string) => {
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  };
  previous.split(/;\s*/).filter(Boolean).forEach(put);
  for (const cookie of res.getSetCookie()) put(cookie.split(";")[0]!);
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Signs up (credential) and signs in `username`, returning an authenticated `cookie` header. */
export async function signUpAndSignIn(
  deps: Deps,
  username: string,
): Promise<{ headers: Headers; userId: string }> {
  const auth = createAuth(deps.env, deps.db);
  await auth.api.signUpEmail({
    body: { email: placeholderEmail(username), username, password: "password123", name: username },
  });
  const res = await auth.api.signInUsername({
    body: { username, password: "password123" },
    returnHeaders: true,
  });
  const headers = new Headers({ cookie: cookieHeader(res.headers) });
  return { headers, userId: res.response!.user.id };
}

export type SeedUserOptions = {
  username?: string | null;
  name?: string;
};

/** Seeds a plain `user` row for tests that only need an account (e.g. invite admins/redeemers). */
export async function seedUser(
  db: ReturnType<typeof createDb>,
  options: SeedUserOptions = {},
): Promise<{ userId: string; username: string | null; name: string }> {
  const userId = randomId();
  const name = options.name ?? `user-${userId.slice(0, 8)}`;
  const username = options.username === undefined ? `user${userId.slice(0, 8)}` : options.username;

  await db.insert(user).values({
    id: userId,
    name,
    email: `${userId}@example.com`,
    emailVerified: false,
    username,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { userId, username, name };
}

export type OnboardStreamerOptions = {
  slug?: string;
  payoutActive?: boolean;
  minAmountSatang?: number;
};

/**
 * Onboards an already-existing user as a full streamer (profile, tip page,
 * payout account, alert overlay + a single default variant) — everything
 * `seedStreamer` does except creating the `user` row itself. For tests that
 * already have a real auth user (e.g. via `signUpAndSignIn`) and need it to
 * pass `apiRequireOnboarded`.
 */
export async function onboardStreamer(
  db: ReturnType<typeof createDb>,
  streamerId: string,
  options: OnboardStreamerOptions = {},
): Promise<{ slug: string; token: string }> {
  const slug = options.slug ?? `streamer-${streamerId.slice(0, 8)}`;
  const payoutActive = options.payoutActive ?? true;
  const minAmountSatang = options.minAmountSatang ?? DEFAULT_ALERT_SETTINGS.minAmountSatang;
  const token = `tok-${streamerId}`;

  await db.insert(streamerProfile).values({
    userId: streamerId,
    slug,
    createdAt: new Date(),
  });

  await db.insert(tipPage).values({
    userId: streamerId,
    channelName: slug,
    links: [],
  });

  await db.insert(payoutAccount).values({
    userId: streamerId,
    provider: "mock",
    externalAccountId: `macct_${streamerId}`,
    status: payoutActive ? "active" : "pending",
  });

  await db.insert(overlay).values({
    id: randomId(),
    streamerId,
    type: "alert",
    token,
    settings: { minAmountSatang },
    updatedAt: new Date(),
  });

  await db.insert(alertVariant).values({
    id: randomId(),
    streamerId,
    name: "ค่าเริ่มต้น",
    minAmountSatang: 0,
    weight: 1,
    messageTemplate: "{name} โดเนท {amount} บาท",
    textColor: "#FFFFFF",
    fontFamily: "Prompt",
    fontSize: 36,
    imageUrl: null,
    soundUrl: "preset:chime",
    animationIn: "fade",
    animationOut: "fade",
    durationMs: 8000,
    ttsEnabled: false,
    ttsVoice: null,
    sortOrder: 0,
  });

  return { slug, token };
}

export type SeedStreamerOptions = OnboardStreamerOptions;

export type SeededStreamer = {
  streamerId: string;
  slug: string;
  token: string;
};

/**
 * Seeds a full streamer (user, profile, tip page, payout account, alert
 * overlay + a single default variant) for integration tests. Reused across
 * donation, overlay, and alert tests.
 */
export async function seedStreamer(
  db: ReturnType<typeof createDb>,
  options: SeedStreamerOptions = {},
): Promise<SeededStreamer> {
  const streamerId = randomId();
  const slug = options.slug ?? `streamer-${streamerId.slice(0, 8)}`;

  await db.insert(user).values({
    id: streamerId,
    name: slug,
    email: `${streamerId}@example.com`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { token } = await onboardStreamer(db, streamerId, { ...options, slug });

  return { streamerId, slug, token };
}
