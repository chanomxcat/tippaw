import { handleConnectPayout } from "@/server/profile/api";
import { getDeps } from "@/server/env";

export async function POST(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleConnectPayout(deps, req);
}
