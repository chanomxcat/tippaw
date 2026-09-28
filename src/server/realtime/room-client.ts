import type { AppEnv } from "@/server/env";

/**
 * Resolves the Durable Object stub for a streamer's realtime room.
 *
 * Deliberately its own module, separate from `streamer-room.ts` (which
 * `extends DurableObject` from the real `cloudflare:workers` module — only
 * resolvable inside the Workers runtime). This function only needs
 * `AppEnv["STREAMER_ROOM"]`'s *type*, so callers reachable from the Next.js
 * app (e.g. the payment webhook route, via `publish()`) can import it
 * without dragging `cloudflare:workers` into `next build`'s page-data
 * collection or the OpenNext server-function bundle.
 */
export function roomFor(ns: AppEnv["STREAMER_ROOM"], streamerId: string) {
  return ns.get(ns.idFromName(streamerId));
}
