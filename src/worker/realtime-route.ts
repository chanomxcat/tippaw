import { eq } from "drizzle-orm";
import type { AppEnv } from "@/server/env";
import { createDb } from "@/server/db/client";
import { overlay } from "@/server/db/schema";
import { roomFor } from "@/server/realtime/room-client";

/**
 * Handles requests under `/api/realtime/{token}`. Validates the WebSocket
 * upgrade and the overlay token, then forwards the request to that
 * streamer's `StreamerRoom` Durable Object (tagged with the token via the
 * `x-overlay-token` header) to complete the handshake.
 */
export async function handleRealtimeRequest(
  request: Request,
  env: AppEnv,
): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const url = new URL(request.url);
  const token = url.pathname.replace(/^\/api\/realtime\//, "");
  if (!token) {
    return new Response("Not Found", { status: 404 });
  }

  const db = createDb(env.DB);
  const [row] = await db
    .select({ streamerId: overlay.streamerId })
    .from(overlay)
    .where(eq(overlay.token, token))
    .limit(1);

  if (!row) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-overlay-token", token);
  const forwardRequest = new Request(request, { headers });

  const room = roomFor(env.STREAMER_ROOM, row.streamerId);
  return room.fetch(forwardRequest);
}
