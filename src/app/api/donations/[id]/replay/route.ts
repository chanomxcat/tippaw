import { handleReplayDonation } from "@/server/donations/api";
import { getDeps } from "@/server/env";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const deps = await getDeps();
  return handleReplayDonation(deps, req, id);
}
