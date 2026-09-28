import { handlePatchInvite } from "@/server/admin/api";
import { getDeps } from "@/server/env";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const deps = await getDeps();
  const { code } = await params;
  return handlePatchInvite(deps, req, code);
}
