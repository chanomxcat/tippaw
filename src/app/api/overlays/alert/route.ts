import { handleGetAlertOverlay, handlePutAlertOverlay } from "@/server/overlays/api";
import { getDeps } from "@/server/env";

export async function GET(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleGetAlertOverlay(deps, req);
}

export async function PUT(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handlePutAlertOverlay(deps, req);
}
