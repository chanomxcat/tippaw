import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createAuth, placeholderEmail } from "@/server/auth/auth";
import { buildAuthorizeRedirect } from "@/server/auth/mock-streamlabs";
import {
  apiRequireAdmin,
  apiRequireOnboarded,
  apiRequireSession,
  resolveSessionState,
} from "@/server/auth/session";
import { createDb } from "@/server/db/client";
import { account, inviteCode, inviteRedemption, streamerProfile, user } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";

function makeDeps(overrides: Partial<AppEnv> = {}): Deps {
  return {
    env: { ...(env as unknown as AppEnv), ...overrides },
    db: createDb(env.DB),
    now: () => new Date(),
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

async function addProfile(deps: Deps, userId: string) {
  await deps.db.insert(streamerProfile).values({
    userId,
    slug: `s-${userId.slice(0, 8).toLowerCase()}`,
    createdAt: new Date(),
  });
}

async function addRedemption(deps: Deps, userId: string) {
  const code = `C${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await deps.db.insert(inviteCode).values({ code, createdBy: userId, usedCount: 1 });
  await deps.db.insert(inviteRedemption).values({ userId, code });
}

describe("createAuth", () => {
  it("placeholderEmail lowercases the username", () => {
    expect(placeholderEmail("Neko")).toBe("neko@users.tippaw.invalid");
  });

  it("signs up with username and signs in with signInUsername as a streamer", async () => {
    const deps = makeDeps();
    const auth = createAuth(deps.env, deps.db);
    const username = uniqueName("neko");

    await auth.api.signUpEmail({
      body: { email: placeholderEmail(username), username, password: "password123", name: username },
    });

    const result = await auth.api.signInUsername({ body: { username, password: "password123" } });
    expect(result?.user).toBeTruthy();

    const [row] = await deps.db.select().from(user).where(eq(user.username, username));
    expect(row?.role).toBe("streamer");
    expect(row!.id).toMatch(/^[0-9a-f-]{36}$/);

    const [cred] = await deps.db.select().from(account).where(eq(account.userId, row!.id));
    expect(cred?.password).toMatch(/^pbkdf2\$sha256\$100000\$/);
  });

  it("rejects a wrong password", async () => {
    const deps = makeDeps();
    const auth = createAuth(deps.env, deps.db);
    const username = uniqueName("wrong");
    await auth.api.signUpEmail({
      body: { email: placeholderEmail(username), username, password: "password123", name: username },
    });
    await expect(
      auth.api.signInUsername({ body: { username, password: "nope-nope-nope" } }),
    ).rejects.toThrow();
  });

  it("rejects credential sign-up with a non-placeholder email (pre-hijack guard)", async () => {
    const deps = makeDeps();
    const auth = createAuth(deps.env, deps.db);
    const username = uniqueName("hijack");
    const email = `${username}@gmail.com`;
    await expect(
      auth.api.signUpEmail({ body: { email, username, password: "password123", name: username } }),
    ).rejects.toThrow();
    const rows = await deps.db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(0);
  });

  it("rejects credential sign-up via HTTP with a non-placeholder email", async () => {
    const deps = makeDeps();
    const auth = createAuth(deps.env, deps.db);
    const username = uniqueName("hijackhttp");
    const res = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8787" },
        body: JSON.stringify({
          email: `${username}@gmail.com`,
          username,
          password: "password123",
          name: username,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects credential sign-up without a username", async () => {
    const deps = makeDeps();
    const auth = createAuth(deps.env, deps.db);
    const name = uniqueName("nouser");
    await expect(
      auth.api.signUpEmail({
        body: { email: placeholderEmail(name), password: "password123", name },
      }),
    ).rejects.toThrow();
    const rows = await deps.db.select().from(user).where(eq(user.email, placeholderEmail(name)));
    expect(rows).toHaveLength(0);
  });

  it("disables email sign-in (login is username-only)", async () => {
    const deps = makeDeps();
    const auth = createAuth(deps.env, deps.db);
    const username = uniqueName("emailin");
    await auth.api.signUpEmail({
      body: { email: placeholderEmail(username), username, password: "password123", name: username },
    });
    const res = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8787" },
        body: JSON.stringify({ email: placeholderEmail(username), password: "password123" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("completes the mock Streamlabs OAuth flow in-process (no self-fetch)", async () => {
    const deps = makeDeps({ MOCK_MODE: "true", MOCK_STREAMLABS_LOGIN: "true" });
    const auth = createAuth(deps.env, deps.db);

    const start = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8787" },
        body: JSON.stringify({ provider: "streamlabs", callbackURL: "/dashboard" }),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const authorize = new URL(url);
    expect(authorize.origin + authorize.pathname).toBe(
      "http://localhost:8787/mock/streamlabs/authorize",
    );

    const slName = uniqueName("catstreamer");
    const back = buildAuthorizeRedirect({
      redirectUri: authorize.searchParams.get("redirect_uri")!,
      state: authorize.searchParams.get("state")!,
      streamlabsUsername: slName,
    });

    const callback = await auth.handler(
      new Request(back, { headers: { cookie: cookieHeader(start.headers) } }),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/dashboard");

    const [row] = await deps.db
      .select()
      .from(user)
      .where(eq(user.email, `${slName}@streamlabs.mock`));
    expect(row?.name).toBe(slName);
    expect(row?.role).toBe("streamer");
    const [acct] = await deps.db.select().from(account).where(eq(account.userId, row!.id));
    expect(acct?.providerId).toBe("streamlabs");
    expect(acct?.accountId).toBe(`sl_${slName}`);
  });

  it("disables the mock Streamlabs provider when MOCK_MODE is true but MOCK_STREAMLABS_LOGIN is unset (deploy-safety default)", async () => {
    const deps = makeDeps({ MOCK_MODE: "true", MOCK_STREAMLABS_LOGIN: undefined });
    const auth = createAuth(deps.env, deps.db);

    const res = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8787" },
        body: JSON.stringify({ provider: "streamlabs", callbackURL: "/dashboard" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("always uses the local mock authorize path in mock mode, even when STREAMLABS_AUTHORIZE_URL points elsewhere", async () => {
    const deps = makeDeps({
      MOCK_MODE: "true",
      MOCK_STREAMLABS_LOGIN: "true",
      STREAMLABS_AUTHORIZE_URL: "http://example.com/not-the-mock-path",
    });
    const auth = createAuth(deps.env, deps.db);

    const start = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8787" },
        body: JSON.stringify({ provider: "streamlabs", callbackURL: "/dashboard" }),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const authorize = new URL(url);
    expect(authorize.origin + authorize.pathname).toBe(
      "http://localhost:8787/mock/streamlabs/authorize",
    );
  });
});

describe("resolveSessionState", () => {
  it("returns no user without a session cookie", async () => {
    const state = await resolveSessionState(makeDeps(), new Headers());
    expect(state).toEqual({ user: null, onboarded: false });
  });

  it("is not onboarded without a streamer profile", async () => {
    const deps = makeDeps();
    const username = uniqueName("noprof");
    const { headers, userId } = await signUpAndSignIn(deps, username);
    const state = await resolveSessionState(deps, headers);
    expect(state.user).toEqual({ id: userId, name: username, username, role: "streamer" });
    expect(state.onboarded).toBe(false);
  });

  it("is not onboarded with a profile but no redemption (streamer)", async () => {
    const deps = makeDeps();
    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("halfway"));
    await addProfile(deps, userId);
    expect((await resolveSessionState(deps, headers)).onboarded).toBe(false);
  });

  it("is onboarded with a profile and an invite redemption", async () => {
    const deps = makeDeps();
    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("full"));
    await addProfile(deps, userId);
    await addRedemption(deps, userId);
    expect((await resolveSessionState(deps, headers)).onboarded).toBe(true);
  });

  it("treats an admin with a profile as onboarded without a redemption", async () => {
    const deps = makeDeps();
    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("boss"));
    await deps.db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
    await addProfile(deps, userId);
    const state = await resolveSessionState(deps, headers);
    expect(state.user?.role).toBe("admin");
    expect(state.onboarded).toBe(true);
  });
});

describe("api guards", () => {
  it("apiRequireSession returns 401 without a session", async () => {
    const result = await apiRequireSession(makeDeps(), new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("apiRequireSession returns the user with a session", async () => {
    const deps = makeDeps();
    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("guard"));
    const result = await apiRequireSession(deps, headers);
    expect(result.ok && result.user.id).toBe(userId);
  });

  it("apiRequireOnboarded returns 401 / 403 / ok", async () => {
    const deps = makeDeps();
    const anon = await apiRequireOnboarded(deps, new Headers());
    expect(!anon.ok && anon.response.status).toBe(401);

    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("onb"));
    const denied = await apiRequireOnboarded(deps, headers);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.response.status).toBe(403);
      expect(await denied.response.json()).toEqual({ error: "not_onboarded" });
    }

    await addProfile(deps, userId);
    await addRedemption(deps, userId);
    const allowed = await apiRequireOnboarded(deps, headers);
    expect(allowed.ok && allowed.user.id).toBe(userId);
  });

  it("apiRequireAdmin returns 401 / 403 / ok", async () => {
    const deps = makeDeps();
    const anon = await apiRequireAdmin(deps, new Headers());
    expect(!anon.ok && anon.response.status).toBe(401);

    const { headers, userId } = await signUpAndSignIn(deps, uniqueName("adm"));
    const denied = await apiRequireAdmin(deps, headers);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.response.status).toBe(403);
      expect(await denied.response.json()).toEqual({ error: "forbidden" });
    }

    await deps.db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
    const allowed = await apiRequireAdmin(deps, headers);
    expect(allowed.ok && allowed.user.role).toBe("admin");
  });
});
