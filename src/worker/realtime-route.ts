import type { AppEnv } from "@/server/env";

/**
 * Handles requests under `/api/realtime/*`. This is a stub for now —
 * a later task wires it up to the `StreamerRoom` Durable Object.
 */
export async function handleRealtimeRequest(
  _request: Request,
  _env: AppEnv,
): Promise<Response> {
  return new Response("Not Found", { status: 404 });
}
