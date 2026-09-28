import { handleDonationStatus } from "@/server/donations/api";
import { getDeps } from "@/server/env";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const deps = await getDeps();
  return handleDonationStatus(deps, id);
}
