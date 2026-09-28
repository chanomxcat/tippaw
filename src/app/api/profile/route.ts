import { handlePatchProfile } from "@/server/profile/api";
import { getDeps } from "@/server/env";

export async function PATCH(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handlePatchProfile(deps, req);
}
