import { desc } from "drizzle-orm";

import { account, inviteRedemption, streamerProfile, user } from "@/server/db/schema";
import type { Deps } from "@/server/env";

export type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  slug: string | null;
  providers: string[];
  inviteCode: string | null;
  createdAt: Date;
};

/** Maps a better-auth `account.providerId` to its display label. Only `credential` gets renamed. */
function providerLabel(providerId: string): string {
  return providerId === "credential" ? "Local" : providerId;
}

/**
 * All users for the admin CMS, newest first, with the sign-in providers
 * they've linked, their streamer slug (if onboarded), and the invite code
 * they redeemed (if any). Fetches each related table once rather than
 * per-user, to avoid an N+1 query.
 */
export async function listUsers(deps: Deps): Promise<AdminUserRow[]> {
  const [users, accounts, profiles, redemptions] = await Promise.all([
    deps.db.query.user.findMany({ orderBy: desc(user.createdAt) }),
    deps.db.select({ userId: account.userId, providerId: account.providerId }).from(account),
    deps.db.select({ userId: streamerProfile.userId, slug: streamerProfile.slug }).from(streamerProfile),
    deps.db.select({ userId: inviteRedemption.userId, code: inviteRedemption.code }).from(inviteRedemption),
  ]);

  const providersByUser = new Map<string, string[]>();
  for (const a of accounts) {
    const list = providersByUser.get(a.userId) ?? [];
    list.push(providerLabel(a.providerId));
    providersByUser.set(a.userId, list);
  }
  const slugByUser = new Map(profiles.map((p) => [p.userId, p.slug]));
  const codeByUser = new Map(redemptions.map((r) => [r.userId, r.code]));

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    slug: slugByUser.get(u.id) ?? null,
    providers: providersByUser.get(u.id) ?? [],
    inviteCode: codeByUser.get(u.id) ?? null,
    createdAt: u.createdAt,
  }));
}
