import { buildAuthorizeRedirect, isAllowedRedirectUri } from "@/server/auth/mock-streamlabs";
import { getDeps, isMockMode } from "@/server/env";

/**
 * Handles the mock Streamlabs "approve" form submission as a plain HTML
 * form POST (not a React Server Action) so the browser performs a real,
 * full-page navigation and follows the redirect Location header itself.
 *
 * A Server Action's `redirect()` to a non-page URL (the real
 * `/api/auth/callback/streamlabs` route) goes through Next's client-side
 * action-redirect handling instead of an ordinary browser redirect, which
 * doesn't reliably land the browser on the target page. A conventional
 * form POST + HTTP redirect sidesteps that entirely.
 */
export async function POST(req: Request): Promise<Response> {
  const { env } = await getDeps();
  if (!isMockMode(env)) {
    return new Response("Not Found", { status: 404 });
  }

  const formData = await req.formData();
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const streamlabsUsername = String(formData.get("streamlabs_username") ?? "");

  if (!isAllowedRedirectUri(redirectUri, env.BETTER_AUTH_URL)) {
    return new Response("Not Found", { status: 404 });
  }

  let target: string;
  try {
    target = buildAuthorizeRedirect({ redirectUri, state, streamlabsUsername });
  } catch {
    const retry = new URL("/mock/streamlabs/authorize", env.BETTER_AUTH_URL);
    retry.searchParams.set("redirect_uri", redirectUri);
    retry.searchParams.set("state", state);
    retry.searchParams.set("error", "invalid_username");
    return Response.redirect(retry, 303);
  }

  return Response.redirect(target, 303);
}
