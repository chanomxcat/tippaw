import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createAuth, placeholderEmail } from "@/server/auth/auth";
import { handleCreateInvite, handleListInvites, handlePatchInvite } from "@/server/admin/api";
import { listUsers } from "@/server/admin/users";
import { createDb } from "@/server/db/client";
import { account, inviteCode, streamerProfile, user } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";
import { checkInvite } from "@/server/invites/invites";

function makeDeps(now: Date = new Date()): Deps {
  return {
    env: env as unknown as AppEnv,
    db: createDb(env.DB),
    now: () => now,
  };
}

/** Merges `Set-Cookie` response headers into a request `Cookie` header. */
function cookieHeader(res: Headers, previous = ""): string {
  const jar = new Map<string, string>();
  const put = (pair: string) => {
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  };
  previous.split(/;\s*/).filter(Boolean).forEach(put);
  for (const cookie of res.getSetCookie()) put(cookie.split(";")[0]!);
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function uniqueName(prefix: string) {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

async function signUpAndSignIn(deps: Deps, username: string) {
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

async function makeAdmin(deps: Deps, username: string) {
  const { headers, userId } = await signUpAndSignIn(deps, username);
  await deps.db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
  return { headers, userId };
}

function req(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:8787${url}`, init);
}

function jsonReq(url: string, headers: Headers, body: unknown, method = "POST"): Request {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Request(`http://localhost:8787${url}`, {
    method,
    headers: h,
    body: JSON.stringify(body),
  });
}

describe("handleListInvites", () => {
  it("returns 401 when not logged in", async () => {
    const deps = makeDeps();
    const res = await handleListInvites(deps, req("/api/admin/invites", { headers: new Headers() }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a streamer", async () => {
    const deps = makeDeps();
    const { headers } = await signUpAndSignIn(deps, uniqueName("streamer"));
    const res = await handleListInvites(deps, req("/api/admin/invites", { headers }));
    expect(res.status).toBe(403);
  });

  it("returns the invites list for an admin", async () => {
    const deps = makeDeps();
    const { headers, userId } = await makeAdmin(deps, uniqueName("admlist"));
    await deps.db.insert(inviteCode).values({
      code: "LISTME1",
      createdBy: userId,
      createdAt: new Date(),
    });

    const res = await handleListInvites(deps, req("/api/admin/invites", { headers }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: string }[];
    expect(body.some((i) => i.code === "LISTME1")).toBe(true);
  });
});

describe("handleCreateInvite", () => {
  it("creates an 8-char code when none is supplied", async () => {
    const deps = makeDeps();
    const { headers } = await makeAdmin(deps, uniqueName("admcreate"));

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, { note: undefined, maxUses: null, expiresAt: null }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("normalizes a supplied code 'vip-1' to 'VIP-1'", async () => {
    const deps = makeDeps();
    const { headers } = await makeAdmin(deps, uniqueName("admvip"));

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, { code: "vip-1", maxUses: null, expiresAt: null }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VIP-1");
  });

  it("returns 409 for a duplicate supplied code", async () => {
    const deps = makeDeps();
    const { headers, userId } = await makeAdmin(deps, uniqueName("admdup"));
    await deps.db.insert(inviteCode).values({ code: "DUPE1234", createdBy: userId, createdAt: new Date() });

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, { code: "dupe1234", maxUses: null, expiresAt: null }),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "duplicate" });
  });

  it("returns 400 invalid_code for a malformed supplied code", async () => {
    const deps = makeDeps();
    const { headers } = await makeAdmin(deps, uniqueName("admbad"));

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, { code: "ab", maxUses: null, expiresAt: null }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_code" });
  });

  it("returns 400 expires_in_past for an expiresAt not in the future", async () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const deps = makeDeps(now);
    const { headers } = await makeAdmin(deps, uniqueName("admpast"));

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, {
        maxUses: null,
        expiresAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "expires_in_past" });
  });

  it("returns 403 for a streamer", async () => {
    const deps = makeDeps();
    const { headers } = await signUpAndSignIn(deps, uniqueName("nonadmin"));

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, { maxUses: null, expiresAt: null }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 for an out-of-range maxUses", async () => {
    const deps = makeDeps();
    const { headers } = await makeAdmin(deps, uniqueName("admrange"));

    const res = await handleCreateInvite(
      deps,
      jsonReq("/api/admin/invites", headers, { maxUses: 0, expiresAt: null }),
    );

    expect(res.status).toBe(400);
  });
});

describe("handlePatchInvite", () => {
  it("disables an invite; checkInvite then returns false", async () => {
    const deps = makeDeps();
    const { headers, userId } = await makeAdmin(deps, uniqueName("admpatch"));
    await deps.db.insert(inviteCode).values({ code: "PATCHME1", createdBy: userId, createdAt: new Date() });
    expect(await checkInvite(deps, "PATCHME1")).toBe(true);

    const res = await handlePatchInvite(
      deps,
      jsonReq("/api/admin/invites/PATCHME1", headers, { disabled: true }, "PATCH"),
      "PATCHME1",
    );

    expect(res.status).toBe(200);
    expect(await checkInvite(deps, "PATCHME1")).toBe(false);
  });

  it("returns 404 for an unknown code", async () => {
    const deps = makeDeps();
    const { headers } = await makeAdmin(deps, uniqueName("admpatch404"));

    const res = await handlePatchInvite(
      deps,
      jsonReq("/api/admin/invites/NOPE1234", headers, { disabled: true }, "PATCH"),
      "NOPE1234",
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 for a streamer", async () => {
    const deps = makeDeps();
    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("patchstreamer"));
    await deps.db.insert(inviteCode).values({ code: "STAYSAFE", createdBy: userId, createdAt: new Date() });

    const res = await handlePatchInvite(
      deps,
      jsonReq("/api/admin/invites/STAYSAFE", headers, { disabled: true }, "PATCH"),
      "STAYSAFE",
    );

    expect(res.status).toBe(403);
  });
});

describe("listUsers", () => {
  it("returns users with providers, slug, and invite code", async () => {
    const deps = makeDeps();
    const { userId: adminId } = await makeAdmin(deps, uniqueName("admlu"));

    const username = uniqueName("catlu");
    const { userId: streamerId } = await signUpAndSignIn(deps, username);
    await deps.db.insert(streamerProfile).values({
      userId: streamerId,
      slug: `slug-${streamerId.slice(0, 8)}`,
      createdAt: new Date(),
    });
    const code = "USERLIST";
    await deps.db.insert(inviteCode).values({ code, createdBy: adminId, createdAt: new Date() });
    const { redeemInvite } = await import("@/server/invites/invites");
    await redeemInvite(deps, streamerId, code);

    const rows = await listUsers(deps);
    const row = rows.find((r) => r.id === streamerId);
    expect(row).toBeDefined();
    expect(row?.username).toBe(username);
    expect(row?.slug).toBe(`slug-${streamerId.slice(0, 8)}`);
    expect(row?.providers).toEqual(["Local"]);
    expect(row?.inviteCode).toBe(code);
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it("maps the credential provider to 'Local' and leaves other providers as-is", async () => {
    const deps = makeDeps();
    const streamerId = crypto.randomUUID();
    await deps.db.insert(user).values({
      id: streamerId,
      name: "OAuth Cat",
      email: `${streamerId}@example.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await deps.db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: streamerId,
      providerId: "streamlabs",
      userId: streamerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rows = await listUsers(deps);
    const row = rows.find((r) => r.id === streamerId);
    expect(row?.providers).toEqual(["streamlabs"]);
    expect(row?.slug).toBeNull();
    expect(row?.inviteCode).toBeNull();
  });
});
