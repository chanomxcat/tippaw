import { SELF, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDb } from "@/server/db/client";
import { user } from "@/server/db/auth-schema";
import { alertVariant, donation } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";
import { createDonation } from "@/server/donations/create-donation";
import { replayAlert, sendTestAlert } from "@/server/donations/alerts";
import { handleReplayDonation } from "@/server/donations/api";
import { handlePaymentEvent, handleWebhookRequest } from "@/server/donations/handle-payment-event";
import { getDonationStatus, listPaidDonations } from "@/server/donations/queries";
import { buildMockWebhookRequest, createMockProvider } from "@/server/payments/mock";
import type { PaymentEvent } from "@/server/payments/types";

import { onboardStreamer, seedStreamer, signUpAndSignIn, uniqueName } from "./helpers";

function req(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:8787${url}`, init);
}

/**
 * Signs up, signs in, and fully onboards a fresh streamer for
 * `handleReplayDonation` tests (which need a real auth session, unlike
 * `seedStreamer`'s directly-inserted `user` row). Promoted to admin to
 * satisfy `apiRequireOnboarded`'s onboarded check without also seeding a
 * redeemed invite.
 */
async function onboardedCaller(deps: Deps, prefix: string, slug: string) {
  const { headers, userId } = await signUpAndSignIn(deps, uniqueName(prefix));
  await deps.db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
  const { token } = await onboardStreamer(deps.db, userId, { slug });
  return { headers, userId, slug, token };
}

function randomId() {
  return crypto.randomUUID();
}

function makeDeps(): Deps {
  return {
    env: env as unknown as AppEnv,
    db: createDb(env.DB),
    now: () => new Date(),
  };
}

function makeProvider(deps: Deps) {
  return createMockProvider({ secret: deps.env.MOCK_WEBHOOK_SECRET, baseUrl: deps.env.BETTER_AUTH_URL });
}

async function connect(token: string) {
  const response = await SELF.fetch(`http://x/api/realtime/${token}`, {
    headers: { Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  const ws = response.webSocket;
  if (!ws) throw new Error("expected a webSocket on the 101 response");
  ws.accept();

  const queue: string[] = [];
  ws.addEventListener("message", (event) => {
    queue.push(event.data as string);
  });

  return {
    ws,
    async next(timeoutMs = 2000): Promise<Record<string, unknown>> {
      const start = Date.now();
      while (queue.length === 0) {
        if (Date.now() - start > timeoutMs) {
          throw new Error("timed out waiting for a socket message");
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return JSON.parse(queue.shift()!);
    },
    async expectNone(waitMs = 150): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      if (queue.length > 0) {
        throw new Error(`expected no message, got: ${queue[0]}`);
      }
    },
  };
}

async function readDonationRow(deps: Deps, donationId: string) {
  const row = await deps.db.query.donation.findFirst({ where: eq(donation.id, donationId) });
  if (!row) throw new Error("donation not found");
  return row;
}

describe("createDonation", () => {
  it("records a pending donation with a provider_session_id", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);

    const result = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.checkoutUrl).toMatch(/^http:\/\/localhost:8787\/mock\/checkout\//);

    const row = await readDonationRow(deps, result.donationId);
    expect(row.status).toBe("pending");
    expect(row.providerSessionId).toBeTruthy();
    expect(row.amountSatang).toBe(10000);
  });

  it("returns not_accepting when the streamer's payout isn't active", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db, { payoutActive: false });

    const result = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });

    expect(result).toEqual({ ok: false, reason: "not_accepting" });
  });

  it("returns not_found for an unknown slug", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);

    const result = await createDonation(deps, provider, {
      slug: `no-such-streamer-${randomId()}`,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("handlePaymentEvent", () => {
  async function pay(deps: Deps, provider: ReturnType<typeof makeProvider>, sessionId: string) {
    const event: PaymentEvent = { eventId: `evt-${randomId()}`, type: "payment.succeeded", sessionId };
    return handlePaymentEvent(deps, provider.name, event);
  }

  async function fail(deps: Deps, provider: ReturnType<typeof makeProvider>, sessionId: string) {
    const event: PaymentEvent = { eventId: `evt-${randomId()}`, type: "payment.failed", sessionId };
    return handlePaymentEvent(deps, provider.name, event);
  }

  it("marks the donation paid and publishes an alert with the rendered headline", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    const result = await pay(deps, provider, row.providerSessionId!);
    expect(result).toEqual({ outcome: "paid", published: true });

    const paidRow = await readDonationRow(deps, created.donationId);
    expect(paidRow.status).toBe("paid");
    expect(paidRow.paidAt).toBeInstanceOf(Date);

    const alertMessage = await socket.next();
    expect(alertMessage.type).toBe("alert");
    expect(alertMessage.headline).toBe("แมว โดเนท 100 บาท");

    const paidMessage = await socket.next();
    expect(paidMessage.type).toBe("donation.paid");
  });

  it("returns duplicate and does not re-publish for a repeated event id", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    const event: PaymentEvent = { eventId: `evt-${randomId()}`, type: "payment.succeeded", sessionId: row.providerSessionId! };
    const first = await handlePaymentEvent(deps, provider.name, event);
    expect(first).toEqual({ outcome: "paid", published: true });
    await socket.next(); // alert
    await socket.next(); // donation.paid

    const second = await handlePaymentEvent(deps, provider.name, event);
    expect(second).toEqual({ outcome: "duplicate", published: false });
    await socket.expectNone();
  });

  it("ignores a second succeeded event (new event id) once already paid, without publishing", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    await pay(deps, provider, row.providerSessionId!);
    await socket.next(); // alert
    await socket.next(); // donation.paid

    const second = await pay(deps, provider, row.providerSessionId!);
    expect(second).toEqual({ outcome: "ignored", published: false });
    await socket.expectNone();

    const stillPaid = await readDonationRow(deps, created.donationId);
    expect(stillPaid.status).toBe("paid");
  });

  it("ignores a failed event that arrives after the donation is already paid", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    await pay(deps, provider, row.providerSessionId!);
    await socket.next(); // alert
    await socket.next(); // donation.paid

    const result = await fail(deps, provider, row.providerSessionId!);
    expect(result).toEqual({ outcome: "ignored", published: false });
    await socket.expectNone();

    const stillPaid = await readDonationRow(deps, created.donationId);
    expect(stillPaid.status).toBe("paid");
  });

  it("marks the donation failed and does not publish when it fails while pending", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    const result = await fail(deps, provider, row.providerSessionId!);
    expect(result).toEqual({ outcome: "failed", published: false });
    await socket.expectNone();

    const failedRow = await readDonationRow(deps, created.donationId);
    expect(failedRow.status).toBe("failed");
  });

  it("publishes when the amount exactly meets the overlay's minimum", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db, { minAmountSatang: 1000 });
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 10, // 1000 satang, equal to the minimum
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    const result = await pay(deps, provider, row.providerSessionId!);
    expect(result).toEqual({ outcome: "paid", published: true });

    const alertMessage = await socket.next();
    expect(alertMessage.type).toBe("alert");
  });

  it("does not publish (but still pays) when the amount is below the overlay's minimum", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db, { minAmountSatang: 2000 });
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 10, // 1000 satang, below the 2000 minimum
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    const result = await pay(deps, provider, row.providerSessionId!);
    expect(result).toEqual({ outcome: "paid", published: false });
    await socket.expectNone();

    const paidRow = await readDonationRow(deps, created.donationId);
    expect(paidRow.status).toBe("paid");
  });
});

describe("handleWebhookRequest", () => {
  it("returns 400 for an invalid signature", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const req = new Request(`${deps.env.BETTER_AUTH_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "evt_x", type: "payment.succeeded", data: { sessionId: "mcs_x" } }),
    });

    const response = await handleWebhookRequest(deps, provider, req);
    expect(response.status).toBe(400);
  });

  it("returns 200 and applies a validly signed event", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);

    const req = await buildMockWebhookRequest({
      secret: deps.env.MOCK_WEBHOOK_SECRET,
      sessionId: row.providerSessionId!,
      outcome: "succeeded",
      baseUrl: deps.env.BETTER_AUTH_URL,
    });

    const response = await handleWebhookRequest(deps, provider, req);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const paidRow = await readDonationRow(deps, created.donationId);
    expect(paidRow.status).toBe("paid");
  });
});

describe("replayAlert", () => {
  it("returns not_found for another streamer's donation", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const owner = await seedStreamer(deps.db);
    const other = await seedStreamer(deps.db);

    const created = await createDonation(deps, provider, {
      slug: owner.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);
    await handlePaymentEvent(deps, provider.name, {
      eventId: `evt-${randomId()}`,
      type: "payment.succeeded",
      sessionId: row.providerSessionId!,
    });

    const result = await replayAlert(deps, other.streamerId, created.donationId);
    expect(result).toBe("not_found");
  });

  it("publishes the alert for the streamer's own paid donation, ignoring the overlay minimum", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db, { minAmountSatang: 2000 });
    const socket = await connect(streamer.token);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 10, // 1000 satang, below the streamer's 2000 minimum
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);
    await handlePaymentEvent(deps, provider.name, {
      eventId: `evt-${randomId()}`,
      type: "payment.succeeded",
      sessionId: row.providerSessionId!,
    });
    // The initial paid webhook didn't publish (below minimum); drain nothing, socket queue empty.

    const result = await replayAlert(deps, streamer.streamerId, created.donationId);
    expect(result).toBe("ok");

    const alertMessage = await socket.next();
    expect(alertMessage.type).toBe("alert");
  });

  it("returns not_published when the donation exists but no alert variant is configured", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);
    // seedStreamer always creates a default variant; drop it so no variant qualifies.
    await deps.db.delete(alertVariant).where(eq(alertVariant.streamerId, streamer.streamerId));

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);
    await handlePaymentEvent(deps, provider.name, {
      eventId: `evt-${randomId()}`,
      type: "payment.succeeded",
      sessionId: row.providerSessionId!,
    });

    const result = await replayAlert(deps, streamer.streamerId, created.donationId);
    expect(result).toBe("not_published");
  });
});

describe("handleReplayDonation", () => {
  it("returns 401 when not logged in", async () => {
    const deps = makeDeps();
    const res = await handleReplayDonation(
      deps,
      req("/api/donations/x/replay", { method: "POST" }),
      "x",
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 and replays the alert for the caller's own paid donation", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const { headers, slug, token } = await onboardedCaller(deps, "replay", uniqueName("rp").slice(0, 20));
    const socket = await connect(token);

    const created = await createDonation(deps, provider, {
      slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);
    await handlePaymentEvent(deps, provider.name, {
      eventId: `evt-${randomId()}`,
      type: "payment.succeeded",
      sessionId: row.providerSessionId!,
    });
    await socket.next(); // initial alert
    await socket.next(); // donation.paid

    const res = await handleReplayDonation(
      deps,
      req(`/api/donations/${created.donationId}/replay`, { method: "POST", headers }),
      created.donationId,
    );
    expect(res.status).toBe(200);

    const replayed = await socket.next();
    expect(replayed.type).toBe("alert");
  });

  it("returns 404 for a donation that doesn't belong to the caller", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const owner = await seedStreamer(deps.db);

    const created = await createDonation(deps, provider, {
      slug: owner.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);
    await handlePaymentEvent(deps, provider.name, {
      eventId: `evt-${randomId()}`,
      type: "payment.succeeded",
      sessionId: row.providerSessionId!,
    });

    const { headers } = await onboardedCaller(deps, "otherreplay", uniqueName("other").slice(0, 20));

    const res = await handleReplayDonation(
      deps,
      req(`/api/donations/${created.donationId}/replay`, { method: "POST", headers }),
      created.donationId,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("returns 409 no_alert_config when the donation exists but no alert is configured", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const { headers, userId, slug } = await onboardedCaller(deps, "noalert", uniqueName("na").slice(0, 20));
    await deps.db.delete(alertVariant).where(eq(alertVariant.streamerId, userId));

    const created = await createDonation(deps, provider, {
      slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");
    const row = await readDonationRow(deps, created.donationId);
    await handlePaymentEvent(deps, provider.name, {
      eventId: `evt-${randomId()}`,
      type: "payment.succeeded",
      sessionId: row.providerSessionId!,
    });

    const res = await handleReplayDonation(
      deps,
      req(`/api/donations/${created.donationId}/replay`, { method: "POST", headers }),
      created.donationId,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_alert_config" });
  });
});

describe("sendTestAlert", () => {
  it("publishes a synthetic alert without recording a donation", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db);
    const socket = await connect(streamer.token);

    await sendTestAlert(deps, streamer.streamerId);

    const alertMessage = await socket.next();
    expect(alertMessage.type).toBe("alert");
    expect(alertMessage.donorName).toBe("TipPaw");
  });
});

describe("getDonationStatus", () => {
  it("returns the donation's status and its streamer's slug", async () => {
    const deps = makeDeps();
    const provider = makeProvider(deps);
    const streamer = await seedStreamer(deps.db);

    const created = await createDonation(deps, provider, {
      slug: streamer.slug,
      donorName: "แมว",
      message: "",
      amountThb: 100,
    });
    if (!created.ok) throw new Error("setup failed");

    const status = await getDonationStatus(deps, created.donationId);
    expect(status).toEqual({ status: "pending", slug: streamer.slug });
  });

  it("returns null for an unknown donation id", async () => {
    const deps = makeDeps();
    const status = await getDonationStatus(deps, randomId());
    expect(status).toBeNull();
  });
});

describe("listPaidDonations", () => {
  it("only includes paid donations, newest first, paginated 50 per page", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db);

    // A pending and a failed donation, which must never appear in the list.
    await deps.db.insert(donation).values({
      id: randomId(),
      streamerId: streamer.streamerId,
      kind: "tip",
      donorName: "Pending Donor",
      amountSatang: 5000,
      status: "pending",
      provider: "mock",
      createdAt: new Date(),
    });
    await deps.db.insert(donation).values({
      id: randomId(),
      streamerId: streamer.streamerId,
      kind: "tip",
      donorName: "Failed Donor",
      amountSatang: 5000,
      status: "failed",
      provider: "mock",
      createdAt: new Date(),
    });

    const baseMs = Date.parse("2026-01-01T00:00:00Z");
    const total = 51;
    for (let i = 0; i < total; i++) {
      await deps.db.insert(donation).values({
        id: randomId(),
        streamerId: streamer.streamerId,
        kind: "tip",
        donorName: `Donor ${i}`,
        amountSatang: 1000 + i,
        status: "paid",
        provider: "mock",
        createdAt: new Date(baseMs + i * 1000),
        paidAt: new Date(baseMs + i * 1000),
      });
    }

    const page1 = await listPaidDonations(deps, streamer.streamerId, 1);
    expect(page1.items).toHaveLength(50);
    expect(page1.total).toBe(51);
    // Newest first: the last-inserted donation (i = 50) sorts first.
    expect(page1.items[0]!.donorName).toBe("Donor 50");

    const page2 = await listPaidDonations(deps, streamer.streamerId, 2);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]!.donorName).toBe("Donor 0");
    expect(page2.total).toBe(51);
  });

  it("treats a non-integer or non-positive page as page 1", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db);

    await deps.db.insert(donation).values({
      id: randomId(),
      streamerId: streamer.streamerId,
      kind: "tip",
      donorName: "Solo",
      amountSatang: 1000,
      status: "paid",
      provider: "mock",
      createdAt: new Date(),
      paidAt: new Date(),
    });

    for (const page of [0, -5, 1.5, NaN]) {
      const result = await listPaidDonations(deps, streamer.streamerId, page);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.donorName).toBe("Solo");
    }
  });

  it("breaks paidAt ties with a stable secondary sort by id, newest id first", async () => {
    const deps = makeDeps();
    const streamer = await seedStreamer(deps.db);
    const sameTime = new Date("2026-01-01T00:00:00Z");
    const ids = [randomId(), randomId(), randomId()].sort();

    for (const id of ids) {
      await deps.db.insert(donation).values({
        id,
        streamerId: streamer.streamerId,
        kind: "tip",
        donorName: `Tie ${id}`,
        amountSatang: 1000,
        status: "paid",
        provider: "mock",
        createdAt: sameTime,
        paidAt: sameTime,
      });
    }

    const result = await listPaidDonations(deps, streamer.streamerId, 1);
    expect(result.items.map((item) => item.id)).toEqual([...ids].reverse());
  });
});
