import { createDb } from "@/server/db/client";
import { alertVariant, overlay, payoutAccount, streamerProfile, tipPage } from "@/server/db/schema";
import { user } from "@/server/db/auth-schema";
import { DEFAULT_ALERT_SETTINGS } from "@/server/alerts/schemas";

function randomId() {
  return crypto.randomUUID();
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

export type SeedStreamerOptions = {
  slug?: string;
  payoutActive?: boolean;
  minAmountSatang?: number;
};

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
  const payoutActive = options.payoutActive ?? true;
  const minAmountSatang = options.minAmountSatang ?? DEFAULT_ALERT_SETTINGS.minAmountSatang;
  const token = `tok-${streamerId}`;

  await db.insert(user).values({
    id: streamerId,
    name: slug,
    email: `${streamerId}@example.com`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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

  return { streamerId, slug, token };
}
