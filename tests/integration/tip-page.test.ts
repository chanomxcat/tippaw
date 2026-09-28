import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createAuth, placeholderEmail } from "@/server/auth/auth";
import { createDb } from "@/server/db/client";
import { streamerProfile, tipPage, user } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";
import { handleGetTipPage, handlePutTipPage } from "@/server/tip-page/api";
import { getPublicTipPage, getTipPage, updateTipPage } from "@/server/tip-page/tip-page";

import { seedStreamer } from "./helpers";

function makeDeps(now: Date = new Date()): Deps {
  return {
    env: env as unknown as AppEnv,
    db: createDb(env.DB),
    now: () => now,
  };
}

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

function jsonReq(url: string, headers: Headers, body: unknown, method = "PUT"): Request {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Request(`http://localhost:8787${url}`, { method, headers: h, body: JSON.stringify(body) });
}

describe("getTipPage / updateTipPage", () => {
  it("returns the current tip page", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "tp1" });

    const page = await getTipPage(deps, streamer.streamerId);
    expect(page?.channelName).toBe("tp1");
    expect(page?.links).toEqual([]);
  });

  it("returns null for a user with no tip page", async () => {
    const deps = makeDeps();
    expect(await getTipPage(deps, crypto.randomUUID())).toBeNull();
  });

  it("updates channelName, links, successMessage, failureMessage and persists", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "tp2" });

    await updateTipPage(deps, streamer.streamerId, {
      channelName: "New Name",
      links: [{ label: "Twitter", url: "https://twitter.com/me" }],
      successMessage: "ขอบคุณมาก",
      failureMessage: "ลองใหม่",
    });

    const page = await getTipPage(deps, streamer.streamerId);
    expect(page).toEqual({
      channelName: "New Name",
      links: [{ label: "Twitter", url: "https://twitter.com/me" }],
      successMessage: "ขอบคุณมาก",
      failureMessage: "ลองใหม่",
    });
  });
});

describe("getPublicTipPage", () => {
  it("normalizes the slug before searching and reports accepting", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db, { slug: "pubcat", payoutActive: true });
    await updateTipPage(deps, streamer.streamerId, {
      channelName: "Pub Cat",
      links: [],
      successMessage: "ขอบคุณ",
      failureMessage: "ไม่สำเร็จ",
    });

    const result = await getPublicTipPage(deps, "  PubCat  ");

    expect(result).toEqual({
      streamerId: streamer.streamerId,
      slug: "pubcat",
      channelName: "Pub Cat",
      links: [],
      successMessage: "ขอบคุณ",
      failureMessage: "ไม่สำเร็จ",
      accepting: true,
    });
  });

  it("returns null for an unknown slug", async () => {
    const deps = makeDeps();
    expect(await getPublicTipPage(deps, "no-such-slug")).toBeNull();
  });
});

describe("handleGetTipPage / handlePutTipPage", () => {
  it("returns 401 when not logged in", async () => {
    const deps = makeDeps();
    const res = await handleGetTipPage(deps, req("/api/tip-page", { headers: new Headers() }));
    expect(res.status).toBe(401);
  });

  it("gets and updates the tip page for an onboarded user", async () => {
    const deps = makeDeps();
    const { headers, userId } = await makeOnboardedAdmin(deps, uniqueName("tp"), "tpslug1");

    const getRes = await handleGetTipPage(deps, req("/api/tip-page", { headers }));
    expect(getRes.status).toBe(200);

    const putRes = await handlePutTipPage(
      deps,
      jsonReq("/api/tip-page", headers, {
        channelName: "Updated",
        links: [{ label: "YT", url: "https://youtube.com/me" }],
        successMessage: "ขอบคุณ",
        failureMessage: "ไม่สำเร็จ",
      }),
    );
    expect(putRes.status).toBe(200);

    const page = await getTipPage(deps, userId);
    expect(page?.channelName).toBe("Updated");
    expect(page?.links).toEqual([{ label: "YT", url: "https://youtube.com/me" }]);
  });

  it("returns 400 for a link with an http:// URL", async () => {
    const deps = makeDeps();
    const { headers } = await makeOnboardedAdmin(deps, uniqueName("tpbad"), "tpslug2");

    const res = await handlePutTipPage(
      deps,
      jsonReq("/api/tip-page", headers, {
        channelName: "X",
        links: [{ label: "Bad", url: "http://insecure.com" }],
        successMessage: "a",
        failureMessage: "b",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });
});
