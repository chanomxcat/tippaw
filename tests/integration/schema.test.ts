import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createDb } from "@/server/db/client";
import {
  streamerProfile,
  overlay,
  donation,
} from "@/server/db/schema";
import { user } from "@/server/db/auth-schema";

function randomId() {
  return crypto.randomUUID();
}

/** Drizzle wraps the driver error in `DrizzleQueryError`; the D1 "UNIQUE
 * constraint failed" message lives on `.cause`, not the top-level message. */
async function expectUniqueViolation(promise: Promise<unknown>) {
  await expect(promise).rejects.toSatisfy((error: unknown) => {
    const cause = (error as { cause?: unknown }).cause;
    const message =
      cause instanceof Error ? cause.message : String(error);
    return /UNIQUE/.test(message);
  });
}

async function insertUser(db: ReturnType<typeof createDb>, username: string) {
  const id = randomId();
  await db.insert(user).values({
    id,
    name: username,
    email: `${username}@example.com`,
    emailVerified: false,
    username,
    displayUsername: username,
    role: "streamer",
    banned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

describe("D1 schema", () => {
  it("rejects duplicate slug", async () => {
    const db = createDb(env.DB);
    const user1 = await insertUser(db, `user1_${randomId()}`);
    const user2 = await insertUser(db, `user2_${randomId()}`);

    await db.insert(streamerProfile).values({
      userId: user1,
      slug: "abc",
      createdAt: new Date(),
    });

    await expectUniqueViolation(
      db.insert(streamerProfile).values({
        userId: user2,
        slug: "abc",
        createdAt: new Date(),
      }),
    );
  });

  it("rejects second overlay of same type per streamer", async () => {
    const db = createDb(env.DB);
    const userId = await insertUser(db, `overlay_user_${randomId()}`);

    await db.insert(overlay).values({
      id: randomId(),
      streamerId: userId,
      type: "alert",
      token: randomId(),
      settings: {},
      updatedAt: new Date(),
    });

    await expectUniqueViolation(
      db.insert(overlay).values({
        id: randomId(),
        streamerId: userId,
        type: "alert",
        token: randomId(),
        settings: {},
        updatedAt: new Date(),
      }),
    );
  });

  it("rejects duplicate provider_session_id", async () => {
    const db = createDb(env.DB);
    const userId = await insertUser(db, `donation_user_${randomId()}`);
    const sessionId = randomId();

    await db.insert(donation).values({
      id: randomId(),
      streamerId: userId,
      kind: "tip",
      donorName: "Someone",
      amountSatang: 1000,
      status: "pending",
      provider: "mock",
      providerSessionId: sessionId,
      createdAt: new Date(),
    });

    await expectUniqueViolation(
      db.insert(donation).values({
        id: randomId(),
        streamerId: userId,
        kind: "tip",
        donorName: "Someone Else",
        amountSatang: 2000,
        status: "pending",
        provider: "mock",
        providerSessionId: sessionId,
        createdAt: new Date(),
      }),
    );
  });
});
