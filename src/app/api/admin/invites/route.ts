import { handleCreateInvite, handleListInvites } from "@/server/admin/api";
import { getDeps } from "@/server/env";

export async function GET(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleListInvites(deps, req);
}

export async function POST(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleCreateInvite(deps, req);
}
