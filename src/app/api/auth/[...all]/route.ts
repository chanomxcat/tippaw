import { toNextJsHandler } from "better-auth/next-js";

import { createAuth } from "@/server/auth/auth";
import { getDeps } from "@/server/env";

// Workers bindings are per-request, so build the auth instance per request.
async function handler(req: Request): Promise<Response> {
  const deps = await getDeps();
  return createAuth(deps.env, deps.db).handler(req);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
