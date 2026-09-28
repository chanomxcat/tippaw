"use server";

import { notFound } from "next/navigation";

import { getDeps, isMockMode } from "@/server/env";
import { runSimulatedPayment, type SimulatedPaymentResult } from "@/server/payments/simulate";

export type { SimulatedPaymentResult };

/**
 * Server action behind the mock checkout page's two buttons. Applies the
 * simulated outcome in-process (`runSimulatedPayment` never calls `fetch`)
 * and returns either the result page's URL for the client to navigate to,
 * or a typed error the client shows as an alert — it doesn't `redirect()`
 * itself, so `runSimulatedPayment`'s return value stays directly testable.
 */
export async function simulatePayment(
  sessionId: string,
  outcome: "succeeded" | "failed",
): Promise<SimulatedPaymentResult> {
  const deps = await getDeps();
  if (!isMockMode(deps.env)) notFound();

  const result = await runSimulatedPayment(deps, sessionId, outcome);
  if (!result) notFound();

  return result;
}
