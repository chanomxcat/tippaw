import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createDb } from "@/server/db/client";
import type { AppEnv, Deps } from "@/server/env";
import { DEFAULT_ALERT_VARIANT } from "@/server/alerts/schemas";
import {
  getAlertOverlayConfig,
  getOverlayByToken,
  resetOverlayToken,
  updateAlertOverlay,
} from "@/server/overlays/overlays";
import {
  handleGetAlertOverlay,
  handlePutAlertOverlay,
  handleResetAlertOverlay,
  handleTestAlert,
} from "@/server/overlays/api";

import { onboardedCaller, seedStreamer, uniqueName } from "./helpers";

function makeDeps(): Deps {
  return {
    env: env as unknown as AppEnv,
    db: createDb(env.DB),
    now: () => new Date(),
  };
}

function req(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:8787${url}`, init);
}

function jsonReq(url: string, headers: Headers, body: unknown, method = "PUT"): Request {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Request(`http://localhost:8787${url}`, { method, headers: h, body: JSON.stringify(body) });
}

async function connect(token: string) {
  const response = await SELF.fetch(`http://x/api/realtime/${token}`, {
    headers: { Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  const ws = response.webSocket;
  if (!ws) throw new Error("expected a webSocket on the 101 response");
  ws.accept();
  return ws;
}

describe("updateAlertOverlay", () => {
  it("updates settings and the variant, reflected by getAlertOverlayConfig", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db);

    await updateAlertOverlay(deps, streamer.streamerId, {
      settings: { minAmountSatang: 5000 },
      variant: {
        ...DEFAULT_ALERT_VARIANT,
        name: "ระดับพิเศษ",
        messageTemplate: "{name} ส่ง {amount}!",
        textColor: "#112233",
        fontSize: 60,
        animationIn: "zoom",
        animationOut: "slide-down",
        durationMs: 12000,
        soundUrl: "preset:coin",
      },
    });

    const config = await getAlertOverlayConfig(deps, streamer.streamerId);
    expect(config).not.toBeNull();
    expect(config!.overlay.settings).toEqual({ minAmountSatang: 5000 });
    expect(config!.variant.name).toBe("ระดับพิเศษ");
    expect(config!.variant.messageTemplate).toBe("{name} ส่ง {amount}!");
    expect(config!.variant.textColor).toBe("#112233");
    expect(config!.variant.fontSize).toBe(60);
    expect(config!.variant.animationIn).toBe("zoom");
    expect(config!.variant.animationOut).toBe("slide-down");
    expect(config!.variant.durationMs).toBe(12000);
    expect(config!.variant.soundUrl).toBe("preset:coin");
  });
});

describe("resetOverlayToken", () => {
  it("issues a new token, invalidates the old one, and closes sockets connected with it", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db);
    const oldToken = streamer.token;

    const ws = await connect(oldToken);
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      ws.addEventListener("close", (event) => {
        resolve({ code: event.code, reason: event.reason });
      });
    });

    const newToken = await resetOverlayToken(deps, streamer.streamerId, "alert");
    expect(newToken).not.toBe(oldToken);

    const closeInfo = await closed;
    expect(closeInfo.code).toBe(4001);

    expect(await getOverlayByToken(deps, oldToken)).toBeNull();
    expect(await getOverlayByToken(deps, newToken)).toEqual({
      streamerId: streamer.streamerId,
      type: "alert",
    });
  });
});

describe("getOverlayByToken", () => {
  it("returns null for an unknown token", async () => {
    const deps = makeDeps();
    expect(await getOverlayByToken(deps, "does-not-exist")).toBeNull();
  });
});

describe("handleGetAlertOverlay", () => {
  it("returns 401 when not logged in", async () => {
    const deps = makeDeps();
    const res = await handleGetAlertOverlay(deps, req("/api/overlays/alert"));
    expect(res.status).toBe(401);
  });

  it("returns overlayUrl, settings, and variant for the caller", async () => {
    const deps = makeDeps();
    const caller = await onboardedCaller(deps, "get", uniqueName("get").slice(0, 20));

    const res = await handleGetAlertOverlay(deps, req("/api/overlays/alert", { headers: caller.headers }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { overlayUrl: string; settings: unknown; variant: unknown };
    expect(body.overlayUrl).toBe(`${deps.env.BETTER_AUTH_URL}/overlay/alert/${caller.token}`);
    expect(body.settings).toEqual({ minAmountSatang: 1000 });
  });
});

describe("handlePutAlertOverlay", () => {
  it("returns 400 for an invalid variant (bad textColor)", async () => {
    const deps = makeDeps();
    const caller = await onboardedCaller(deps, "putbad", uniqueName("putbad").slice(0, 20));

    const res = await handlePutAlertOverlay(
      deps,
      jsonReq("/api/overlays/alert", caller.headers, {
        settings: { minAmountSatang: 1000 },
        variant: { ...DEFAULT_ALERT_VARIANT, textColor: "red" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("persists valid settings + variant", async () => {
    const deps = makeDeps();
    const caller = await onboardedCaller(deps, "putok", uniqueName("putok").slice(0, 20));

    const res = await handlePutAlertOverlay(
      deps,
      jsonReq("/api/overlays/alert", caller.headers, {
        settings: { minAmountSatang: 2500 },
        variant: { ...DEFAULT_ALERT_VARIANT, name: "แบบใหม่" },
      }),
    );
    expect(res.status).toBe(200);

    const config = await getAlertOverlayConfig(deps, caller.userId);
    expect(config!.overlay.settings).toEqual({ minAmountSatang: 2500 });
    expect(config!.variant.name).toBe("แบบใหม่");
  });
});

describe("handleTestAlert", () => {
  it("publishes a test alert ignoring the overlay's minimum, returns 204", async () => {
    const deps = makeDeps();
    const caller = await onboardedCaller(deps, "test", uniqueName("test").slice(0, 20));
    // Raise the minimum so a normal donation wouldn't qualify.
    await updateAlertOverlay(deps, caller.userId, {
      settings: { minAmountSatang: 99999900 },
      variant: DEFAULT_ALERT_VARIANT,
    });

    const ws = await connect(caller.token);
    const received = new Promise<string>((resolve) => {
      ws.addEventListener("message", (event) => resolve(event.data as string));
    });

    const res = await handleTestAlert(deps, req("/api/overlays/alert/test", { method: "POST", headers: caller.headers }));
    expect(res.status).toBe(204);

    const message = JSON.parse(await received);
    expect(message.type).toBe("alert");
  });
});

describe("handleResetAlertOverlay", () => {
  it("returns a new overlayUrl and invalidates the old token", async () => {
    const deps = makeDeps();
    const caller = await onboardedCaller(deps, "reset", uniqueName("reset").slice(0, 20));

    const res = await handleResetAlertOverlay(
      deps,
      req("/api/overlays/alert/reset", { method: "POST", headers: caller.headers }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { overlayUrl: string };
    expect(body.overlayUrl).not.toContain(caller.token);

    expect(await getOverlayByToken(deps, caller.token)).toBeNull();
  });
});
