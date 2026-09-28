import { handleTestAlert } from "@/server/overlays/api";
import { getDeps } from "@/server/env";

export async function POST(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleTestAlert(deps, req);
}
