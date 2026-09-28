import { handleGetTipPage, handlePutTipPage } from "@/server/tip-page/api";
import { getDeps } from "@/server/env";

export async function GET(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleGetTipPage(deps, req);
}

export async function PUT(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handlePutTipPage(deps, req);
}
