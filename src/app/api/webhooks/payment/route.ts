import { handlePaymentWebhook } from "@/server/donations/api";
import { getDeps } from "@/server/env";

export async function POST(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handlePaymentWebhook(deps, req);
}
