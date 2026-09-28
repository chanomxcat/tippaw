import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createDb } from "@/server/db/client";
import { inviteCode } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";
import {
  checkInvite,
  createInvite,
  hasRedeemed,
  listInvites,
  listInviteUsers,
  redeemInvite,
  setInviteDisabled,
} from "@/server/invites/invites";

import { seedUser } from "./helpers";

function randomId() {
  return crypto.randomUUID();
}

function makeDeps(now: Date = new Date()): Deps {
  return {
    env: env as unknown as AppEnv,
    db: createDb(env.DB),
    now: () => now,
  };
}

async function seedInvite(
  deps: Deps,
  adminId: string,
  overrides: Partial<typeof inviteCode.$inferInsert> = {},
) {
  const code = overrides.code ?? `CODE${randomId().slice(0, 4).toUpperCase()}`;
  await deps.db.insert(inviteCode).values({
    code,
    note: null,
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    disabledAt: null,
    createdBy: adminId,
    createdAt: new Date(),
    ...overrides,
  });
  return code;
}

describe("redeemInvite", () => {
  it("redeems a valid code, returns true, and increments used_count", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId);

    const result = await redeemInvite(deps, redeemer.userId, code);
    expect(result).toBe(true);

    const row = await deps.db.query.inviteCode.findFirst({ where: (t, { eq }) => eq(t.code, code) });
    expect(row?.usedCount).toBe(1);
  });

  it("returns false for a code that doesn't exist", async () => {
    const deps = makeDeps();
    const redeemer = await seedUser(deps.db);

    const result = await redeemInvite(deps, redeemer.userId, "NOSUCHCODE");
    expect(result).toBe(false);
  });

  it("returns false for a disabled code", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId, { disabledAt: new Date() });

    const result = await redeemInvite(deps, redeemer.userId, code);
    expect(result).toBe(false);
  });

  it("returns false for an expired code", async () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const deps = makeDeps(now);
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId, {
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await redeemInvite(deps, redeemer.userId, code);
    expect(result).toBe(false);
  });

  it("returns false for an invalid raw code without querying the DB", async () => {
    const deps = makeDeps();
    const redeemer = await seedUser(deps.db);

    const result = await redeemInvite(deps, redeemer.userId, "ab");
    expect(result).toBe(false);
  });

  it("with maxUses 1, exactly one of two concurrent redeemers wins, used_count stays 1", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemerA = await seedUser(deps.db);
    const redeemerB = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId, { maxUses: 1 });

    const results = await Promise.all([
      redeemInvite(deps, redeemerA.userId, code),
      redeemInvite(deps, redeemerB.userId, code),
    ]);

    const trueCount = results.filter((r) => r === true).length;
    expect(trueCount).toBe(1);

    const row = await deps.db.query.inviteCode.findFirst({ where: (t, { eq }) => eq(t.code, code) });
    expect(row?.usedCount).toBe(1);
  });

  it("is idempotent: a user who already redeemed gets true again without incrementing used_count", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId);

    const first = await redeemInvite(deps, redeemer.userId, code);
    expect(first).toBe(true);

    const second = await redeemInvite(deps, redeemer.userId, code);
    expect(second).toBe(true);

    const row = await deps.db.query.inviteCode.findFirst({ where: (t, { eq }) => eq(t.code, code) });
    expect(row?.usedCount).toBe(1);
  });

  it("accepts a lowercase, padded raw code (' vip-1 ')", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db);
    await seedInvite(deps, admin.userId, { code: "VIP-1" });

    const result = await redeemInvite(deps, redeemer.userId, " vip-1 ");
    expect(result).toBe(true);
  });
});

describe("checkInvite", () => {
  it("returns true for a valid code without consuming a use", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId, { maxUses: 1 });

    const result = await checkInvite(deps, code);
    expect(result).toBe(true);

    const row = await deps.db.query.inviteCode.findFirst({ where: (t, { eq }) => eq(t.code, code) });
    expect(row?.usedCount).toBe(0);
  });

  it("returns false for an invalid raw code", async () => {
    const deps = makeDeps();
    const result = await checkInvite(deps, "ab");
    expect(result).toBe(false);
  });

  it("returns false for a disabled code", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId, { disabledAt: new Date() });

    const result = await checkInvite(deps, code);
    expect(result).toBe(false);
  });

  it("returns false for a code that has hit maxUses", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId, { maxUses: 1, usedCount: 1 });

    const result = await checkInvite(deps, code);
    expect(result).toBe(false);
  });
});

describe("createInvite", () => {
  it("auto-generates a code when none is supplied", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);

    const result = await createInvite(deps, admin.userId, {
      maxUses: null,
      expiresAt: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("uses a supplied code after normalizing it", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);

    const result = await createInvite(deps, admin.userId, {
      code: " vip-club ",
      maxUses: null,
      expiresAt: null,
    });

    expect(result).toEqual({ ok: true, code: "VIP-CLUB" });
  });

  it("returns invalid_code for a malformed supplied code", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);

    const result = await createInvite(deps, admin.userId, {
      code: "ab",
      maxUses: null,
      expiresAt: null,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_code" });
  });

  it("returns duplicate for a supplied code that collides, without retrying", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const existing = await seedInvite(deps, admin.userId, { code: "TAKEN123" });

    const result = await createInvite(deps, admin.userId, {
      code: existing,
      maxUses: null,
      expiresAt: null,
    });

    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });
});

describe("setInviteDisabled", () => {
  it("disables and re-enables an existing invite", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId);

    const disabled = await setInviteDisabled(deps, code, true);
    expect(disabled).toBe(true);
    let row = await deps.db.query.inviteCode.findFirst({ where: (t, { eq }) => eq(t.code, code) });
    expect(row?.disabledAt).toBeInstanceOf(Date);

    const enabled = await setInviteDisabled(deps, code, false);
    expect(enabled).toBe(true);
    row = await deps.db.query.inviteCode.findFirst({ where: (t, { eq }) => eq(t.code, code) });
    expect(row?.disabledAt).toBeNull();
  });

  it("returns false for an unknown code", async () => {
    const deps = makeDeps();
    const result = await setInviteDisabled(deps, "NOSUCHCODE", true);
    expect(result).toBe(false);
  });
});

describe("listInvites", () => {
  it("lists invites newest first", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const baseMs = Date.parse("2026-01-01T00:00:00Z");
    const codeA = await seedInvite(deps, admin.userId, {
      code: "AAAA1111",
      createdAt: new Date(baseMs),
    });
    const codeB = await seedInvite(deps, admin.userId, {
      code: "BBBB2222",
      createdAt: new Date(baseMs + 1000),
    });

    const rows = await listInvites(deps);
    const codes = rows.map((r) => r.code);
    expect(codes.indexOf(codeB)).toBeLessThan(codes.indexOf(codeA));
  });
});

describe("listInviteUsers", () => {
  it("returns the users who redeemed a given code", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db, { username: "catlover", name: "Cat Lover" });
    const code = await seedInvite(deps, admin.userId);

    await redeemInvite(deps, redeemer.userId, code);

    const users = await listInviteUsers(deps, code);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      userId: redeemer.userId,
      username: "catlover",
      name: "Cat Lover",
    });
    expect(users[0]!.redeemedAt).toBeInstanceOf(Date);
  });

  it("returns an empty array for a code with no redemptions", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId);

    const users = await listInviteUsers(deps, code);
    expect(users).toEqual([]);
  });
});

describe("hasRedeemed", () => {
  it("returns true once a user has redeemed any code", async () => {
    const deps = makeDeps();
    const admin = await seedUser(deps.db);
    const redeemer = await seedUser(deps.db);
    const code = await seedInvite(deps, admin.userId);
    await redeemInvite(deps, redeemer.userId, code);

    expect(await hasRedeemed(deps, redeemer.userId)).toBe(true);
  });

  it("returns false for a user who hasn't redeemed", async () => {
    const deps = makeDeps();
    const someone = await seedUser(deps.db);
    expect(await hasRedeemed(deps, someone.userId)).toBe(false);
  });
});
