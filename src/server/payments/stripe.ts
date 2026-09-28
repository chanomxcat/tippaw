/**
 * Stripe provider stub. Task 5 only wires the `PaymentProvider` shape and
 * selection logic (`getPaymentProvider`); the real Stripe integration lands
 * in a later task. Every method throws until then.
 */

import type { PaymentProvider } from "./types";

const NOT_IMPLEMENTED = "Stripe provider not implemented";

export function createStripeProvider(): PaymentProvider {
  return {
    name: "stripe",
    async createCheckout() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async parseWebhook() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async connectAccount() {
      throw new Error(NOT_IMPLEMENTED);
    },
  };
}
