import { DurableObject } from "cloudflare:workers";
import type { AppEnv } from "@/server/env";
import type { RealtimeEvent } from "@/server/realtime/events";

/**
 * Durable Object hub for a single streamer's realtime overlay connections.
 * OBS overlays connect over WebSocket via `/api/realtime/{token}`
 * (routed to this room by `handleRealtimeRequest`) and receive
 * `RealtimeEvent`s broadcast through `publish()`.
 *
 * Uses the WebSocket Hibernation API (`ctx.acceptWebSocket` /
 * `ctx.getWebSockets`) so the DO can hibernate between events — no
 * connection state is kept in memory.
 */
export class StreamerRoom extends DurableObject<AppEnv> {
  /** Accepts the WebSocket upgrade; tags the socket with its overlay token (from `x-overlay-token`). */
  async fetch(request: Request): Promise<Response> {
    const token = request.headers.get("x-overlay-token");
    if (!token) {
      return new Response("Bad Request", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [token]);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Broadcasts `event` to every connected overlay socket. Returns the number of sockets it was sent to. */
  async broadcast(event: RealtimeEvent): Promise<number> {
    const payload = JSON.stringify(event);
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
        sent++;
      } catch {
        // Ignore sockets that fail to send (e.g. already closing).
      }
    }
    return sent;
  }

  /** Closes every socket tagged with `token` (e.g. when an overlay token is rotated). */
  async disconnectToken(token: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets(token)) {
      try {
        ws.close(4001, "token reset");
      } catch {
        // Ignore sockets that are already closing/closed.
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (message === "ping") {
      ws.send("pong");
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    ws.close(code, reason);
  }
}
