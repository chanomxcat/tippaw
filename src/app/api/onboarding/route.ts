import { handleOnboarding } from "@/server/onboarding/api";
import { getDeps } from "@/server/env";

export async function POST(req: Request): Promise<Response> {
  const deps = await getDeps();
  return handleOnboarding(deps, req);
}
