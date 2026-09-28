import { APIError } from "better-auth/api";
import { z } from "zod";

import type { Deps } from "@/server/env";
import { clientIp, jsonError, parseJson } from "@/server/http";
import { checkInvite, redeemInvite } from "@/server/invites/invites";

import { createAuth, placeholderEmail } from "./auth";

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_.]{3,30}$/),
  password: z.string().min(8),
  inviteCode: z.string(),
});

/**
 * `POST /api/register`: rate-limits by IP, rejects an invalid/unusable
 * invite code before creating an account (so we never orphan a user who
 * can't redeem), signs up the credential account via better-auth (forwarding
 * its Set-Cookie header, since `nextCookies()` isn't enabled), then redeems
 * the invite for the new user.
 */
export async function handleRegister(deps: Deps, req: Request): Promise<Response> {
  const ip = clientIp(req);
  const { success } = await deps.env.INVITE_RATE_LIMITER.limit({ key: ip });
  if (!success) return jsonError(429, "rate_limited");

  const parsed = await parseJson(registerSchema, req);
  if (!parsed.ok) return parsed.response;
  const { username, password, inviteCode } = parsed.data;

  const inviteValid = await checkInvite(deps, inviteCode);
  if (!inviteValid) return jsonError(400, "invite_invalid");

  const auth = createAuth(deps.env, deps.db);

  let signUpResult: { headers: Headers; response: { user: { id: string } } };
  try {
    signUpResult = (await auth.api.signUpEmail({
      body: { name: username, username, email: placeholderEmail(username), password },
      returnHeaders: true,
    })) as { headers: Headers; response: { user: { id: string } } };
  } catch (err) {
    if (err instanceof APIError) {
      return jsonError(400, "sign_up_failed");
    }
    throw err;
  }

  await redeemInvite(deps, signUpResult.response.user.id, inviteCode);

  return Response.json(
    { ok: true },
    { headers: signUpResult.headers },
  );
}
