import type { RealtimeEvent } from "@/server/realtime/events";
import { nextDelay } from "@/overlay/backoff";

/** The realtime room closes an overlay socket with this code after its token is rotated. Never reconnect after it. */
const TOKEN_RESET_CLOSE_CODE = 4001;

const PING_INTERVAL_MS = 30_000;

export type ConnectOverlayOpts = {
  url: string;
  onEvent: (event: RealtimeEvent) => void;
  onStatus?: (status: "open" | "closed") => void;
  WebSocketImpl?: typeof WebSocket;
  setTimeoutImpl?: typeof setTimeout;
};

/**
 * Connects to the overlay's realtime WebSocket, reconnecting with
 * exponential backoff (`nextDelay`) on every close except a token-reset
 * close (code 4001, sent after the streamer rotates the overlay URL) — that
 * one is final. Sends `'ping'` every 30s to keep the connection alive; the
 * server replies `'pong'`, which is ignored (not surfaced via `onEvent`).
 */
export function connectOverlay(opts: ConnectOverlayOpts): { close(): void } {
  const WebSocketCtor = opts.WebSocketImpl ?? WebSocket;
  const scheduleTimeout = opts.setTimeoutImpl ?? setTimeout;

  let attempt = 0;
  let closedByCaller = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPingTimer(): void {
    if (pingTimer !== null) {
      clearTimeout(pingTimer);
      pingTimer = null;
    }
  }

  function schedulePing(): void {
    clearPingTimer();
    pingTimer = scheduleTimeout(() => {
      try {
        socket?.send("ping");
      } catch {
        // Socket is closing/closed; the close handler will deal with it.
      }
      schedulePing();
    }, PING_INTERVAL_MS);
  }

  function connect(): void {
    if (closedByCaller) return;

    const ws = new WebSocketCtor(opts.url);
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      opts.onStatus?.("open");
      schedulePing();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (event.data === "pong") return;
      try {
        const parsed = JSON.parse(event.data as string) as RealtimeEvent;
        opts.onEvent(parsed);
      } catch {
        // Ignore malformed messages.
      }
    };

    ws.onclose = (event: CloseEvent) => {
      clearPingTimer();
      opts.onStatus?.("closed");
      if (closedByCaller) return;
      if (event.code === TOKEN_RESET_CLOSE_CODE) return;

      const delay = nextDelay(attempt);
      attempt += 1;
      reconnectTimer = scheduleTimeout(connect, delay);
    };

    ws.onerror = () => {
      // `onclose` always follows `onerror` for a WebSocket; reconnect logic lives there.
    };
  }

  connect();

  return {
    close(): void {
      closedByCaller = true;
      clearPingTimer();
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
    },
  };
}
