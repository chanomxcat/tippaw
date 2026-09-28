import { handleRegister } from "@/server/auth/register-api";
import { getDeps } from "@/server/env";

export async function POST(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleRegister(deps, req);
}
