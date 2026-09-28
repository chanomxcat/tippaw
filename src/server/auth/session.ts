import { eq } from "drizzle-orm";

import { streamerProfile } from "@/server/db/schema";
import type { Deps } from "@/server/env";
import { jsonError } from "@/server/http";
import { hasRedeemed } from "@/server/invites/invites";

import { createAuth } from "./auth";

// Next-specific Server Component guards (getSession/requireSession/...) live in
// ./page-guards.ts: importing next/navigation here would break the Workers
// integration test pool, which exercises everything in this file.

export type SessionUser = {
  id: string;
  name: string;
  username: string | null;
  role: "admin" | "streamer";
};

export type SessionState = { user: SessionUser | null; onboarded: boolean };

export type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: Response };

/** Current session user (or null) for the given request headers. */
export async function loadSessionUser(deps: Deps, headers: Headers): Promise<SessionUser | null> {
  const session = await createAuth(deps.env, deps.db).api.getSession({ headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { username?: string | null; role?: string | null };
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? null,
    role: u.role === "admin" ? "admin" : "streamer",
  };
}

async function isOnboarded(deps: Deps, user: SessionUser): Promise<boolean> {
  const [profile] = await deps.db
    .select({ userId: streamerProfile.userId })
    .from(streamerProfile)
    .where(eq(streamerProfile.userId, user.id))
    .limit(1);
  if (!profile) return false;
  return user.role === "admin" || (await hasRedeemed(deps, user.id));
}

/** Onboarded = has a streamer_profile AND (redeemed an invite OR is admin). */
export async function resolveSessionState(deps: Deps, headers: Headers): Promise<SessionState> {
  const user = await loadSessionUser(deps, headers);
  if (!user) return { user: null, onboarded: false };
  return { user, onboarded: await isOnboarded(deps, user) };
}

// ---- API guards (testable: take deps + headers) ----

export async function apiRequireSession(deps: Deps, headers: Headers): Promise<GuardResult> {
  const user = await loadSessionUser(deps, headers);
  if (!user) return { ok: false, response: jsonError(401, "unauthorized") };
  return { ok: true, user };
}

export async function apiRequireOnboarded(deps: Deps, headers: Headers): Promise<GuardResult> {
  const { user, onboarded } = await resolveSessionState(deps, headers);
  if (!user) return { ok: false, response: jsonError(401, "unauthorized") };
  if (!onboarded) return { ok: false, response: jsonError(403, "not_onboarded") };
  return { ok: true, user };
}

export async function apiRequireAdmin(deps: Deps, headers: Headers): Promise<GuardResult> {
  const user = await loadSessionUser(deps, headers);
  if (!user) return { ok: false, response: jsonError(401, "unauthorized") };
  if (user.role !== "admin") return { ok: false, response: jsonError(403, "forbidden") };
  return { ok: true, user };
}
