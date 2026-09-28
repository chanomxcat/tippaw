import { z } from "zod";

import { apiRequireOnboarded } from "@/server/auth/session";
import type { Deps } from "@/server/env";
import { jsonError, parseJson } from "@/server/http";
import { getPaymentProvider } from "@/server/payments";

import { connectPayout, updateSlug } from "./profile";

const patchProfileSchema = z.object({ slug: z.string() });

/** `PATCH /api/profile`: updates the caller's slug. Maps failure reasons to status codes. */
export async function handlePatchProfile(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(patchProfileSchema, req);
  if (!parsed.ok) return parsed.response;

  const result = await updateSlug(deps, guard.user.id, parsed.data.slug);
  if (!result.ok) {
    const status = result.reason === "slug_taken" ? 409 : 400;
    return jsonError(status, result.reason);
  }

  return Response.json({ slug: result.slug });
}

/** `POST /api/profile/payout`: connects (or reconnects) the caller's payout account. */
export async function handleConnectPayout(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const provider = getPaymentProvider(deps.env);
  const result = await connectPayout(deps, provider, guard.user.id);
  return Response.json(result);
}
