import { desc, eq } from "drizzle-orm";

import type { Deps } from "@/server/env";
import { inviteCode, inviteRedemption, user } from "@/server/db/schema";
import { normalizeInviteCode, randomInviteCode } from "@/server/lib/random";

const MAX_GENERATE_ATTEMPTS = 5;

export type InviteRow = {
  code: string;
  note: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
};

export type InviteUserRow = {
  userId: string;
  username: string | null;
  name: string;
  redeemedAt: Date;
};

export type CreateInviteInput = {
  code?: string;
  note?: string;
  maxUses: number | null;
  expiresAt: Date | null;
};

export type CreateInviteResult =
  | { ok: true; code: string }
  | { ok: false; reason: "invalid_code" | "duplicate" };

/** Whether `rawCode` currently resolves to a usable, non-expired, non-disabled invite. Doesn't consume a use. */
export async function checkInvite(deps: Deps, rawCode: string): Promise<boolean> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return false;

  const now = deps.now();
  const row = await deps.db.query.inviteCode.findFirst({ where: eq(inviteCode.code, code) });
  if (!row) return false;
  if (row.disabledAt) return false;
  if (row.expiresAt && row.expiresAt <= now) return false;
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return false;
  return true;
}

/**
 * Redeems `rawCode` for `userId`. Idempotent: a user who already redeemed
 * any code (in practice, this one — redemption is one row per user) gets
 * `true` immediately without re-running the redemption batch.
 *
 * Otherwise runs a single D1 batch: an `INSERT ... SELECT` that only
 * inserts a redemption row when the code is currently valid (not
 * disabled/expired/exhausted), followed by an `UPDATE` that increments
 * `used_count` only if that insert succeeded. Success is judged by the
 * insert's `meta.changes === 1`, so concurrent redeemers against a
 * `maxUses` code can't both win — D1 serializes the batch's writes.
 */
export async function redeemInvite(deps: Deps, userId: string, rawCode: string): Promise<boolean> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return false;

  if (await hasRedeemed(deps, userId)) return true;

  const now = deps.now();
  const nowMs = now.getTime();

  const insertStmt = deps.env.DB.prepare(
    `INSERT INTO invite_redemption (user_id, code, redeemed_at)
     SELECT ?, code, ? FROM invite_code
     WHERE code = ? AND disabled_at IS NULL
       AND (expires_at IS NULL OR expires_at > ?)
       AND (max_uses IS NULL OR used_count < max_uses)`,
  ).bind(userId, nowMs, code, nowMs);

  const updateStmt = deps.env.DB.prepare(
    `UPDATE invite_code SET used_count = used_count + 1
     WHERE code = ? AND EXISTS (
       SELECT 1 FROM invite_redemption WHERE user_id = ? AND code = ? AND redeemed_at = ?
     )`,
  ).bind(code, userId, code, nowMs);

  try {
    const [insertResult] = await deps.env.DB.batch([insertStmt, updateStmt]);
    return insertResult?.meta.changes === 1;
  } catch (err) {
    // A concurrent redeemInvite call for the same user can win the race and
    // insert its invite_redemption row first, so this batch's INSERT then
    // collides on the user_id primary key. Idempotency still holds: if the
    // user is now redeemed, treat it as a successful (redundant) redemption.
    if (await hasRedeemed(deps, userId)) return true;
    throw err;
  }
}

/** Whether `userId` has redeemed any invite code (`invite_redemption` is one row per user). */
export async function hasRedeemed(deps: Deps, userId: string): Promise<boolean> {
  const row = await deps.db.query.inviteRedemption.findFirst({
    where: eq(inviteRedemption.userId, userId),
  });
  return row !== undefined;
}

/**
 * Creates an invite code. Without `input.code`, generates one with
 * `randomInviteCode()`, retrying up to 5 times on collision. With
 * `input.code`, normalizes it and fails with `invalid_code` if malformed
 * or `duplicate` if it already exists — no retry for a supplied code.
 */
export async function createInvite(
  deps: Deps,
  adminId: string,
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  if (input.code !== undefined) {
    const normalized = normalizeInviteCode(input.code);
    if (!normalized) return { ok: false, reason: "invalid_code" };

    const existing = await deps.db.query.inviteCode.findFirst({
      where: eq(inviteCode.code, normalized),
    });
    if (existing) return { ok: false, reason: "duplicate" };

    await insertInvite(deps, adminId, normalized, input);
    return { ok: true, code: normalized };
  }

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const candidate = randomInviteCode();
    const existing = await deps.db.query.inviteCode.findFirst({
      where: eq(inviteCode.code, candidate),
    });
    if (existing) continue;

    await insertInvite(deps, adminId, candidate, input);
    return { ok: true, code: candidate };
  }

  throw new Error(`failed to generate a unique invite code after ${MAX_GENERATE_ATTEMPTS} attempts`);
}

async function insertInvite(
  deps: Deps,
  adminId: string,
  code: string,
  input: CreateInviteInput,
): Promise<void> {
  await deps.db.insert(inviteCode).values({
    code,
    note: input.note ?? null,
    maxUses: input.maxUses,
    usedCount: 0,
    expiresAt: input.expiresAt,
    disabledAt: null,
    createdBy: adminId,
    createdAt: deps.now(),
  });
}

/** Sets (or clears) an invite's `disabled_at`. Returns false when `code` doesn't exist. */
export async function setInviteDisabled(deps: Deps, code: string, disabled: boolean): Promise<boolean> {
  const existing = await deps.db.query.inviteCode.findFirst({ where: eq(inviteCode.code, code) });
  if (!existing) return false;

  await deps.db
    .update(inviteCode)
    .set({ disabledAt: disabled ? deps.now() : null })
    .where(eq(inviteCode.code, code));
  return true;
}

/** All invites, newest first. */
export async function listInvites(deps: Deps): Promise<InviteRow[]> {
  const rows = await deps.db.query.inviteCode.findMany({ orderBy: desc(inviteCode.createdAt) });
  return rows.map((row) => ({
    code: row.code,
    note: row.note,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
  }));
}

/** The users who redeemed `code`. */
export async function listInviteUsers(deps: Deps, code: string): Promise<InviteUserRow[]> {
  const rows = await deps.db
    .select({
      userId: inviteRedemption.userId,
      username: user.username,
      name: user.name,
      redeemedAt: inviteRedemption.redeemedAt,
    })
    .from(inviteRedemption)
    .innerJoin(user, eq(user.id, inviteRedemption.userId))
    .where(eq(inviteRedemption.code, code));
  return rows;
}
