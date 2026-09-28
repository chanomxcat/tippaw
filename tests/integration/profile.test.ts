import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createAuth, placeholderEmail } from "@/server/auth/auth";
import { createDb } from "@/server/db/client";
import { payoutAccount, streamerProfile, tipPage, user } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";
import { getPaymentProvider } from "@/server/payments";
import { handleConnectPayout, handlePatchProfile } from "@/server/profile/api";
import { connectPayout, getProfile, updateSlug } from "@/server/profile/profile";
import { getPublicTipPage } from "@/server/tip-page/tip-page";

import { seedStreamer } from "./helpers";

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

/**
 * Signs up and promotes to admin (admins are always "onboarded" without
 * redeeming an invite), then seeds the `streamer_profile` + `tip_page` rows
 * the profile handlers act on.
 */
async function makeOnboardedAdmin(deps: Deps, username: string, slug: string) {
  const { headers, userId } = await signUpAndSignIn(deps, username);
  await deps.db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
  await deps.db.insert(streamerProfile).values({ userId, slug, createdAt: deps.now() });
  await deps.db.insert(tipPage).values({ userId, channelName: username, links: [] });
  return { headers, userId };
}

function req(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:8787${url}`, init);
}

function jsonReq(url: string, headers: Headers, body: unknown, method = "PATCH"): Request {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Request(`http://localhost:8787${url}`, { method, headers: h, body: JSON.stringify(body) });
}

describe("updateSlug", () => {
  it("changing to the user's own current slug succeeds (not slug_taken)", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "samecat" });

    const result = await updateSlug(deps, streamer.streamerId, "SameCat");

    expect(result).toEqual({ ok: true, slug: "samecat" });
  });

  it("returns slug_taken for a slug already used by another streamer", async () => {
    const deps = makeDeps();
    await seedStreamer(deps.db, { slug: "othercat" });
    const mine = await seedStreamer(deps.db, { slug: "mycat" });

    const result = await updateSlug(deps, mine.streamerId, "othercat");

    expect(result).toEqual({ ok: false, reason: "slug_taken" });
  });

  it("normalizes ' NewCat ' to 'newcat', findable by getPublicTipPage(deps, 'NewCat')", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "oldslug" });

    const result = await updateSlug(deps, streamer.streamerId, " NewCat ");
    expect(result).toEqual({ ok: true, slug: "newcat" });

    const publicPage = await getPublicTipPage(deps, "NewCat");
    expect(publicPage?.streamerId).toBe(streamer.streamerId);
    expect(publicPage?.slug).toBe("newcat");
  });

  it("returns slug_format for an invalid slug", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "shorty1" });

    const result = await updateSlug(deps, streamer.streamerId, "ab");

    expect(result).toEqual({ ok: false, reason: "slug_format" });
  });

  it("returns slug_reserved for a reserved word", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "reservedtest" });

    const result = await updateSlug(deps, streamer.streamerId, "admin");

    expect(result).toEqual({ ok: false, reason: "slug_reserved" });
  });
});

describe("connectPayout", () => {
  it("before connectPayout, getPublicTipPage accepting is false; after, it's true", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "payoutcat", payoutActive: false });
    const provider = getPaymentProvider(deps.env);

    const before = await getPublicTipPage(deps, "payoutcat");
    expect(before?.accepting).toBe(false);

    const result = await connectPayout(deps, provider, streamer.streamerId);
    expect(result.status).toBe("active");

    const after = await getPublicTipPage(deps, "payoutcat");
    expect(after?.accepting).toBe(true);
  });

  it("is idempotent: a second call keeps the same active account (no new externalAccountId)", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "idempotentcat", payoutActive: false });
    const provider = getPaymentProvider(deps.env);

    const first = await connectPayout(deps, provider, streamer.streamerId);
    expect(first.status).toBe("active");
    const [rowAfterFirst] = await deps.db
      .select()
      .from(payoutAccount)
      .where(eq(payoutAccount.userId, streamer.streamerId));

    const second = await connectPayout(deps, provider, streamer.streamerId);
    expect(second.status).toBe("active");
    const [rowAfterSecond] = await deps.db
      .select()
      .from(payoutAccount)
      .where(eq(payoutAccount.userId, streamer.streamerId));

    expect(rowAfterSecond?.externalAccountId).toBe(rowAfterFirst?.externalAccountId);
  });
});

describe("getProfile", () => {
  it("returns slug and payout status", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "profilecat" });

    const profile = await getProfile(deps, streamer.streamerId);

    expect(profile).toEqual({ slug: "profilecat", payout: { provider: "mock", status: "active" } });
  });
});

describe("handlePatchProfile", () => {
  it("returns 401 when not logged in", async () => {
    const deps = makeDeps();
    const res = await handlePatchProfile(deps, jsonReq("/api/profile", new Headers(), { slug: "x" }));
    expect(res.status).toBe(401);
  });

  it("updates the slug for an onboarded user", async () => {
    const deps = makeDeps();
    const { headers } = await makeOnboardedAdmin(deps, uniqueName("prof"), "profslug1");

    const res = await handlePatchProfile(deps, jsonReq("/api/profile", headers, { slug: "profslug2" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: "profslug2" });
  });

  it("returns 409 for a taken slug", async () => {
    const deps = makeDeps();
    await seedStreamer(deps.db, { slug: "takenslug1" });
    const { headers } = await makeOnboardedAdmin(deps, uniqueName("proftaken"), "profslug3");

    const res = await handlePatchProfile(deps, jsonReq("/api/profile", headers, { slug: "takenslug1" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "slug_taken" });
  });

  it("returns 400 slug_format for a malformed slug", async () => {
    const deps = makeDeps();
    const { headers } = await makeOnboardedAdmin(deps, uniqueName("profbad"), "profslug4");

    const res = await handlePatchProfile(deps, jsonReq("/api/profile", headers, { slug: "ab" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "slug_format" });
  });
});

describe("handleConnectPayout", () => {
  it("returns 401 when not logged in", async () => {
    const deps = makeDeps();
    const res = await handleConnectPayout(deps, req("/api/profile/payout", { method: "POST", headers: new Headers() }));
    expect(res.status).toBe(401);
  });

  it("connects the payout account for an onboarded user", async () => {
    const deps = makeDeps();
    const { headers } = await makeOnboardedAdmin(deps, uniqueName("profpay"), "profslug5");

    const res = await handleConnectPayout(deps, req("/api/profile/payout", { method: "POST", headers }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "active" });
  });
});
