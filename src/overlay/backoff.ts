/**
 * Exponential backoff delay (ms) for the overlay's reconnecting WebSocket
 * client: doubles per attempt starting at 1s, capped at 30s.
 */
export function nextDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000);
}
