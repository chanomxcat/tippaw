import { describe, expect, it } from "vitest";
import { InvalidSignatureError } from "@/server/payments/types";
import { buildMockWebhookRequest, createMockProvider, signMockWebhook } from "@/server/payments/mock";

const SECRET = "test-secret";
const BASE_URL = "https://app.test";
const FIXED_NOW_SEC = 1_700_000_000;
const FIXED_NOW_MS = FIXED_NOW_SEC * 1000;

function makeProvider(nowMs = FIXED_NOW_MS) {
  return createMockProvider({ secret: SECRET, baseUrl: BASE_URL, now: () => nowMs });
}

describe("createMockProvider.createCheckout", () => {
  it("returns a checkoutUrl under the mock checkout path", async () => {
    const provider = makeProvider();
    const result = await provider.createCheckout({
      donationId: "d1",
      amountSatang: 10_000,
      streamerAccountId: "acct_1",
      successUrl: "https://app.test/s",
      cancelUrl: "https://app.test/c",
    });
    expect(result.checkoutUrl).toMatch(/^https:\/\/app\.test\/mock\/checkout\/mcs_[0-9a-f-]+$/);
    expect(result.sessionId).toMatch(/^mcs_/);
  });
});

describe("createMockProvider.parseWebhook", () => {
  it("parses a validly signed succeeded event", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC,
    });
    const event = await provider.parseWebhook(req);
    expect(event.type).toBe("payment.succeeded");
    expect(event.sessionId).toBe("mcs_abc");
    expect(event.eventId).toMatch(/^evt_/);
  });

  it("parses a validly signed failed event", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_xyz",
      outcome: "failed",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC,
    });
    const event = await provider.parseWebhook(req);
    expect(event.type).toBe("payment.failed");
    expect(event.sessionId).toBe("mcs_xyz");
  });

  it("rejects a signature produced with the wrong secret", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: "wrong-secret",
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC,
    });
    await expect(provider.parseWebhook(req)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("rejects when the body is modified after signing", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC,
    });
    const signature = req.headers.get("x-tippaw-signature")!;
    const tampered = new Request(req.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tippaw-signature": signature },
      body: JSON.stringify({ id: "evt_tampered", type: "payment.succeeded", data: { sessionId: "mcs_other" } }),
    });
    await expect(provider.parseWebhook(tampered)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("rejects a timestamp more than 300 seconds in the past", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC - 301,
    });
    await expect(provider.parseWebhook(req)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("rejects a timestamp more than 300 seconds in the future", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC + 301,
    });
    await expect(provider.parseWebhook(req)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("accepts a timestamp exactly at the 300 second tolerance boundary", async () => {
    const provider = makeProvider();
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC - 300,
    });
    await expect(provider.parseWebhook(req)).resolves.toMatchObject({ sessionId: "mcs_abc" });
  });

  it("rejects a request with no signature header", async () => {
    const provider = makeProvider();
    const req = new Request(`${BASE_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "evt_1", type: "payment.succeeded", data: { sessionId: "mcs_abc" } }),
    });
    await expect(provider.parseWebhook(req)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("rejects a malformed signature header", async () => {
    const provider = makeProvider();
    const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded", data: { sessionId: "mcs_abc" } });
    const req = new Request(`${BASE_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tippaw-signature": "not-a-valid-header" },
      body,
    });
    await expect(provider.parseWebhook(req)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("rejects a validly signed but malformed JSON body", async () => {
    const provider = makeProvider();
    const body = "{not valid json";
    const signature = await signMockWebhook(body, SECRET, FIXED_NOW_SEC);
    const req = new Request(`${BASE_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tippaw-signature": signature },
      body,
    });
    await expect(provider.parseWebhook(req)).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it("throws a plain Error for an unknown but validly signed event type", async () => {
    const provider = makeProvider();
    const body = JSON.stringify({ id: "evt_1", type: "payment.refunded", data: { sessionId: "mcs_abc" } });
    const signature = await signMockWebhook(body, SECRET, FIXED_NOW_SEC);
    const req = new Request(`${BASE_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tippaw-signature": signature },
      body,
    });
    await expect(provider.parseWebhook(req)).rejects.not.toBeInstanceOf(InvalidSignatureError);
    await expect(provider.parseWebhook(req)).rejects.toThrow();
  });
});

describe("createMockProvider.connectAccount", () => {
  it("returns an externalAccountId with the macct_ prefix", async () => {
    const provider = makeProvider();
    const result = await provider.connectAccount("user_1");
    expect(result.externalAccountId).toMatch(/^macct_/);
  });
});

describe("buildMockWebhookRequest", () => {
  it("targets the webhooks endpoint with a JSON content-type", async () => {
    const req = await buildMockWebhookRequest({
      secret: SECRET,
      sessionId: "mcs_abc",
      outcome: "succeeded",
      baseUrl: BASE_URL,
      nowSec: FIXED_NOW_SEC,
    });
    expect(req.method).toBe("POST");
    expect(req.url).toBe(`${BASE_URL}/api/webhooks/payment`);
    expect(req.headers.get("content-type")).toBe("application/json");
  });
});
