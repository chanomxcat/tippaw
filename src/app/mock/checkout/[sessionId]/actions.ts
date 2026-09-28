"use server";

import { getDeps } from "@/server/env";
import { runSimulatedPayment, type SimulatedPaymentResult } from "@/server/payments/simulate";

export type { SimulatedPaymentResult };

/**
 * Server action behind the mock checkout page's two buttons. A thin
 * `getDeps()` wrapper around `runSimulatedPayment`, which returns typed
 * results for every expected outcome (`not_found` outside mock mode or for
 * an unknown/stale session, `simulate_failed` when applying the webhook
 * fails, or `{ ok: true, redirectTo }`) — this action deliberately never
 * throws its own control-flow error (e.g. `notFound()`) here, since a
 * client component awaiting a server action can't safely wrap that call in
 * try/catch without also swallowing Next.js's own special errors.
 */
export async function simulatePayment(
  sessionId: string,
  outcome: "succeeded" | "failed",
): Promise<SimulatedPaymentResult> {
  const deps = await getDeps();
  return runSimulatedPayment(deps, sessionId, outcome);
}
