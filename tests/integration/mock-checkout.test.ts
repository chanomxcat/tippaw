import { SELF, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createDb } from "@/server/db/client";
import { donation } from "@/server/db/schema";
import type { AppEnv, Deps } from "@/server/env";
import { createDonation } from "@/server/donations/create-donation";
import { getDonationStatus } from "@/server/donations/queries";
import { createMockProvider } from "@/server/payments/mock";
import { runSimulatedPayment } from "@/server/payments/simulate";

import { seedStreamer } from "./helpers";

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

async function readDonationRow(deps: Deps, donationId: string) {
  const row = await deps.db.query.donation.findFirst({ where: eq(donation.id, donationId) });
  if (!row) throw new Error("donation not found");
  return row;
}

/** Connects to a streamer's realtime overlay room, same as donations.test.ts. */
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

describe("runSimulatedPayment", () => {
  it("never calls fetch, marks the donation paid, publishes the alert exactly once, and is idempotent on replay", async () => {
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
    const sessionId = row.providerSessionId!;

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runSimulatedPayment(deps, sessionId, "succeeded");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, redirectTo: `/${streamer.slug}/result?d=${created.donationId}` });

    const status = await getDonationStatus(deps, created.donationId);
    expect(status?.status).toBe("paid");

    // The webhook path publishes an alert + donation.paid, exactly once.
    const alertMessage = await socket.next();
    expect(alertMessage.type).toBe("alert");
    const paidMessage = await socket.next();
    expect(paidMessage.type).toBe("donation.paid");

    // Replay: still paid, no error, no second fetch call, and no second alert.
    const second = await runSimulatedPayment(deps, sessionId, "succeeded");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(second).toEqual({ ok: true, redirectTo: `/${streamer.slug}/result?d=${created.donationId}` });
    await socket.expectNone();

    const statusAfterReplay = await getDonationStatus(deps, created.donationId);
    expect(statusAfterReplay?.status).toBe("paid");

    fetchSpy.mockRestore();
  });

  it("returns null for an unknown session id", async () => {
    const deps = makeDeps();

    const result = await runSimulatedPayment(deps, `mcs_${randomId()}`, "succeeded");
    expect(result).toBeNull();
  });

  it("returns an error result and leaves the donation pending when applying the webhook fails", async () => {
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
    const sessionId = row.providerSessionId!;

    // Force handleWebhookRequest to fail internally: the stripe provider's
    // parseWebhook is an unimplemented stub that throws, so handling the
    // (still mock-signed) request comes back non-ok — the same shape a real
    // signature/D1 failure would take, without needing to fake either.
    const brokenDeps: Deps = { ...deps, env: { ...deps.env, PAYMENT_PROVIDER: "stripe" } };

    const result = await runSimulatedPayment(brokenDeps, sessionId, "succeeded");
    expect(result).toEqual({ ok: false, error: "simulate_failed" });

    const status = await getDonationStatus(deps, created.donationId);
    expect(status?.status).toBe("pending");
  });
});
