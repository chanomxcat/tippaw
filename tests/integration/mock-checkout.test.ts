import { env } from "cloudflare:test";
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

describe("runSimulatedPayment", () => {
  it("never calls fetch, marks the donation paid, and is idempotent on replay", async () => {
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

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runSimulatedPayment(deps, sessionId, "succeeded");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ redirectTo: `/${streamer.slug}/result?d=${created.donationId}` });

    const status = await getDonationStatus(deps, created.donationId);
    expect(status?.status).toBe("paid");

    // Replay: still paid, no error, no second fetch call either.
    const second = await runSimulatedPayment(deps, sessionId, "succeeded");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(second).toEqual({ redirectTo: `/${streamer.slug}/result?d=${created.donationId}` });

    const statusAfterReplay = await getDonationStatus(deps, created.donationId);
    expect(statusAfterReplay?.status).toBe("paid");

    fetchSpy.mockRestore();
  });

  it("returns null for an unknown session id", async () => {
    const deps = makeDeps();

    const result = await runSimulatedPayment(deps, `mcs_${randomId()}`, "succeeded");
    expect(result).toBeNull();
  });
});
