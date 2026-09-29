import { z } from "zod";

import { apiRequireSession } from "@/server/auth/session";
import type { Deps } from "@/server/env";
import { clientIp, jsonError, parseJson } from "@/server/http";

import { completeOnboarding } from "./onboarding";

const onboardingSchema = z.object({
  inviteCode: z.string().optional(),
  slug: z.string(),
});

/**
 * `POST /api/onboarding`: requires a session (401 JSON when missing — the
 * page itself redirects unauthenticated visitors before this is ever hit),
 * rate-limits by IP only when an invite code is supplied, then delegates to
 * `completeOnboarding`. Maps its failure reasons to HTTP status codes.
 */
export async function handleOnboarding(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireSession(deps, req.headers);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = await parseJson(onboardingSchema, req);
  if (!parsed.ok) return parsed.response;
  const { inviteCode, slug } = parsed.data;

  if (inviteCode) {
    const ip = clientIp(req);
    const { success } = await deps.env.INVITE_RATE_LIMITER.limit({ key: ip });
    if (!success) return jsonError(429, "rate_limited");
  }

  const result = await completeOnboarding(deps, user, { inviteCode, slug });
  if (result.ok) {
    return Response.json({ ok: true });
  }

  const status = result.reason === "slug_taken" ? 409 : 400;
  return jsonError(status, result.reason);
}
