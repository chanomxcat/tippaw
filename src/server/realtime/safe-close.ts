/**
 * Some close codes a client's close event can report (e.g. 1005 "no
 * status", 1006 "abnormal closure") are reserved and can never legally be
 * sent back over the wire — calling `ws.close(code, reason)` with one of
 * those throws. Falls back to the generic 1000 in that case; the socket is
 * on its way out regardless of which code we manage to send.
 */
export function safeWebSocketClose(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    try {
      ws.close(1000, reason);
    } catch {
      // Already closed/closing — nothing more to do.
    }
  }
}
