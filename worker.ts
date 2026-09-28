import { handleRealtimeRequest } from "./src/worker/realtime-route";
import type { AppEnv } from "./src/server/env";

// @ts-ignore - only exists after `npm run build` generates the OpenNext output
import openNextHandler from "./.open-next/worker.js";

export default {
  async fetch(
    request: Request,
    env: AppEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/realtime/")) {
      return handleRealtimeRequest(request, env);
    }
    return openNextHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv>;

export { StreamerRoom } from "./src/server/realtime/streamer-room";
