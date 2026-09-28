import { handleRealtimeRequest } from "@/worker/realtime-route";
import type { AppEnv } from "@/server/env";

export { StreamerRoom } from "@/server/realtime/streamer-room";

/**
 * Lightweight entrypoint used only by the integration test pool. Unlike the
 * real `worker.ts`, this never imports `./.open-next/worker.js`, so tests
 * don't require a Next.js build to run.
 */
export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/realtime/")) {
      return handleRealtimeRequest(request, env);
    }
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<AppEnv>;
