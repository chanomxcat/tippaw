import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createDb } from "@/server/db/client";
import { overlay } from "@/server/db/schema";
import { user } from "@/server/db/auth-schema";
import { buildAlertEvent } from "@/server/alerts/build-event";
import { publish, disconnectToken } from "@/server/realtime/publish";
import type { AppEnv } from "@/server/env";

function randomId() {
  return crypto.randomUUID();
}

async function seedStreamer(db: ReturnType<typeof createDb>) {
  const streamerId = randomId();
  await db.insert(user).values({
    id: streamerId,
    name: `streamer_${streamerId}`,
    email: `${streamerId}@example.com`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return streamerId;
}

async function seedOverlay(
  db: ReturnType<typeof createDb>,
  streamerId: string,
  type: "alert" | "gift" | "top" | "recent" | "goal",
  token: string,
) {
  await db.insert(overlay).values({
    id: randomId(),
    streamerId,
    type,
    token,
    settings: {},
    updatedAt: new Date(),
  });
}

function sampleAlertEvent() {
  return buildAlertEvent({
    id: randomId(),
    donorName: "คุณผู้ใจดี",
    amountSatang: 10000,
    message: "สู้ๆ นะ",
    variant: {
      id: randomId(),
      streamerId: "irrelevant",
      name: "default",
      minAmountSatang: 0,
      weight: 1,
      messageTemplate: "{{name}} โดเนท {{amountSatang}}",
      textColor: "#fff",
      fontFamily: "Prompt",
      fontSize: 24,
      imageUrl: null,
      soundUrl: null,
      animationIn: "fade",
      animationOut: "fade",
      durationMs: 5000,
      ttsEnabled: false,
      ttsVoice: null,
      sortOrder: 0,
    } as never,
  });
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

describe("realtime route + StreamerRoom", () => {
  it("broadcasts to connected overlay", async () => {
    const db = createDb(env.DB);
    const streamerId = await seedStreamer(db);
    const token = `tok-1-${randomId()}`;
    await seedOverlay(db, streamerId, "alert", token);

    const ws = await connect(token);
    const received = new Promise<string>((resolve) => {
      ws.addEventListener("message", (event) => {
        resolve(event.data as string);
      });
    });

    const alertEvent = sampleAlertEvent();
    await publish(env as unknown as AppEnv, streamerId, alertEvent);

    const message = await received;
    expect(JSON.parse(message)).toEqual(alertEvent);
  });

  it("rejects unknown token", async () => {
    const response = await SELF.fetch("http://x/api/realtime/does-not-exist", {
      headers: { Upgrade: "websocket" },
    });
    expect(response.status).toBe(404);
  });

  it("requires upgrade", async () => {
    const db = createDb(env.DB);
    const streamerId = await seedStreamer(db);
    const token = `tok-noupgrade-${randomId()}`;
    await seedOverlay(db, streamerId, "alert", token);

    const response = await SELF.fetch(`http://x/api/realtime/${token}`);
    expect(response.status).toBe(426);
  });

  it("disconnectToken closes only that token", async () => {
    const db = createDb(env.DB);
    const streamerId = await seedStreamer(db);
    const tokenA = `tok-1-${randomId()}`;
    const tokenB = `tok-2-${randomId()}`;
    await seedOverlay(db, streamerId, "alert", tokenA);
    await seedOverlay(db, streamerId, "gift", tokenB);

    const wsA = await connect(tokenA);
    const wsB = await connect(tokenB);

    const closedA = new Promise<{ code: number; reason: string }>((resolve) => {
      wsA.addEventListener("close", (event) => {
        resolve({ code: event.code, reason: event.reason });
      });
    });
    const receivedB = new Promise<string>((resolve) => {
      wsB.addEventListener("message", (event) => {
        resolve(event.data as string);
      });
    });

    await disconnectToken(env as unknown as AppEnv, streamerId, tokenA);
    const closeInfo = await closedA;
    expect(closeInfo.code).toBe(4001);
    expect(closeInfo.reason).toBe("token reset");

    const alertEvent = sampleAlertEvent();
    await publish(env as unknown as AppEnv, streamerId, alertEvent);
    const message = await receivedB;
    expect(JSON.parse(message)).toEqual(alertEvent);
  });

  it("replies pong", async () => {
    const db = createDb(env.DB);
    const streamerId = await seedStreamer(db);
    const token = `tok-ping-${randomId()}`;
    await seedOverlay(db, streamerId, "alert", token);

    const ws = await connect(token);
    const received = new Promise<string>((resolve) => {
      ws.addEventListener("message", (event) => {
        resolve(event.data as string);
      });
    });
    ws.send("ping");

    const message = await received;
    expect(message).toBe("pong");
  });
});
