/**
 * Mock payment provider used in `MOCK_MODE`. It never calls out over HTTP —
 * checkout/webhook requests are simulated in-process (Workers can't fetch
 * back into themselves) — but the webhook signature scheme mirrors a real
 * provider's (timestamped HMAC-SHA256, constant-time comparison) so the
 * verification code exercised here is the same shape as `stripe.ts` will use.
 */

import type { CreateCheckoutInput, PaymentEvent, PaymentProvider } from "./types";
import { InvalidSignatureError } from "./types";

const SIGNATURE_HEADER = "x-tippaw-signature";
const SIGNATURE_TOLERANCE_MS = 300_000;

function hexEncode(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return hexEncode(signature);
}

/** Constant-time comparison of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Signs `body` for a given unix-second timestamp: `t=<ts>,v1=<hex HMAC-SHA256 of "<ts>.<body>">`. */
export async function signMockWebhook(body: string, secret: string, timestampSec: number): Promise<string> {
  const mac = await hmacSha256Hex(secret, `${timestampSec}.${body}`);
  return `t=${timestampSec},v1=${mac}`;
}

/** Builds a signed mock webhook `Request` as if the mock provider had sent it. */
export async function buildMockWebhookRequest(opts: {
  secret: string;
  sessionId: string;
  outcome: "succeeded" | "failed";
  baseUrl: string;
  nowSec?: number;
}): Promise<Request> {
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const eventId = `evt_${crypto.randomUUID()}`;
  const body = JSON.stringify({
    id: eventId,
    type: `payment.${opts.outcome}`,
    data: { sessionId: opts.sessionId },
  });
  const signature = await signMockWebhook(body, opts.secret, nowSec);
  return new Request(`${opts.baseUrl}/api/webhooks/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [SIGNATURE_HEADER]: signature,
    },
    body,
  });
}

const SIGNATURE_HEADER_FORMAT = /^t=(\d+),v1=([0-9a-f]+)$/;

export function createMockProvider(opts: { secret: string; baseUrl: string; now?: () => number }): PaymentProvider {
  const now = opts.now ?? Date.now;

  return {
    name: "mock",

    async createCheckout(_input: CreateCheckoutInput) {
      const sessionId = `mcs_${crypto.randomUUID()}`;
      return {
        sessionId,
        checkoutUrl: `${opts.baseUrl}/mock/checkout/${sessionId}`,
      };
    },

    async parseWebhook(req: Request): Promise<PaymentEvent> {
      const header = req.headers.get(SIGNATURE_HEADER);
      if (!header) {
        throw new InvalidSignatureError("Missing signature header");
      }

      const match = SIGNATURE_HEADER_FORMAT.exec(header);
      if (!match) {
        throw new InvalidSignatureError("Malformed signature header");
      }
      const timestampSec = Number(match[1]);
      const providedMac = match[2]!;

      const ageMs = now() - timestampSec * 1000;
      if (Math.abs(ageMs) > SIGNATURE_TOLERANCE_MS) {
        throw new InvalidSignatureError("Signature timestamp outside tolerance");
      }

      const body = await req.text();
      const expectedMac = await hmacSha256Hex(opts.secret, `${timestampSec}.${body}`);
      if (!timingSafeEqualHex(providedMac, expectedMac)) {
        throw new InvalidSignatureError("Signature mismatch");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new InvalidSignatureError("Malformed webhook body");
      }

      const event = parsed as { id?: unknown; type?: unknown; data?: { sessionId?: unknown } };
      if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
        throw new Error(`Unknown webhook event type: ${String(event.type)}`);
      }

      return {
        eventId: String(event.id),
        type: event.type,
        sessionId: String(event.data?.sessionId),
      };
    },

    async connectAccount(_userId: string) {
      return { externalAccountId: `macct_${crypto.randomUUID()}` };
    },
  };
}
