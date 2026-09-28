import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { getDeps } from "@/server/env";

import { loadSessionUser, resolveSessionState, type SessionUser } from "./session";

/**
 * Server Component guards: thin wrappers over the pure functions in
 * ./session.ts that read the request headers and deps themselves.
 */

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const user = await loadSessionUser(await getDeps(), await nextHeaders());
  return user ? { user } : null;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireOnboarded(): Promise<SessionUser> {
  const { user, onboarded } = await resolveSessionState(await getDeps(), await nextHeaders());
  if (!user) redirect("/login");
  if (!onboarded) redirect("/onboarding");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
