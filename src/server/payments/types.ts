/**
 * Shared types for the payment provider adapter. A `PaymentProvider` hides
 * the mock/Stripe distinction behind one interface so route handlers and
 * services never branch on `PAYMENT_PROVIDER` themselves.
 */

export type CreateCheckoutInput = {
  donationId: string;
  amountSatang: number;
  streamerAccountId: string;
  successUrl: string;
  cancelUrl: string;
};

export type PaymentEvent = {
  eventId: string;
  type: "payment.succeeded" | "payment.failed";
  sessionId: string;
};

export interface PaymentProvider {
  name: "mock" | "stripe";
  createCheckout(input: CreateCheckoutInput): Promise<{ sessionId: string; checkoutUrl: string }>;
  parseWebhook(req: Request): Promise<PaymentEvent>;
  connectAccount(userId: string): Promise<{ externalAccountId: string; onboardingUrl?: string }>;
}

/** Thrown by `parseWebhook` when a webhook request's signature can't be verified. */
export class InvalidSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "InvalidSignatureError";
  }
}
