import type { AppEnv } from "../env";
import { createMockProvider } from "./mock";
import { createStripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { CreateCheckoutInput, PaymentEvent, PaymentProvider } from "./types";
export { InvalidSignatureError } from "./types";
export { createMockProvider, signMockWebhook, buildMockWebhookRequest } from "./mock";
export { createStripeProvider } from "./stripe";

/** Selects the payment provider configured by `env.PAYMENT_PROVIDER` (defaults to mock). */
export function getPaymentProvider(env: AppEnv): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "stripe") {
    return createStripeProvider();
  }
  return createMockProvider({ secret: env.MOCK_WEBHOOK_SECRET, baseUrl: env.BETTER_AUTH_URL });
}
