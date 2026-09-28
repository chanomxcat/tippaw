/**
 * In-process mock of the Streamlabs OAuth provider (MOCK_MODE only).
 *
 * The authorize step is a real page (`/mock/streamlabs/authorize`); token
 * exchange and userinfo are plain functions wired into genericOAuth's
 * `getToken` / `getUserInfo` hooks, because a Worker cannot fetch itself.
 */
const TOKEN_PREFIX = "mock_";
const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,50}$/;

export type MockStreamlabsUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: true;
};

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function assertUsername(username: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("invalid_streamlabs_username");
  }
  return username;
}

/** Only allow redirecting back to our own auth origin (prevents open redirect). */
export function isAllowedRedirectUri(redirectUri: string, baseUrl: string): boolean {
  try {
    const target = new URL(redirectUri);
    return target.origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

export function buildAuthorizeRedirect(params: {
  redirectUri: string;
  state: string;
  streamlabsUsername: string;
}): string {
  const username = assertUsername(params.streamlabsUsername.trim());
  const url = new URL(params.redirectUri);
  url.searchParams.set("code", base64UrlEncode(JSON.stringify({ u: username })));
  url.searchParams.set("state", params.state);
  return url.toString();
}

export function exchangeCode(code: string): { accessToken: string } {
  return { accessToken: TOKEN_PREFIX + code };
}

export function userInfo(accessToken: string): MockStreamlabsUser {
  if (!accessToken.startsWith(TOKEN_PREFIX)) throw new Error("invalid_mock_token");
  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(accessToken.slice(TOKEN_PREFIX.length)));
  } catch {
    throw new Error("invalid_mock_token");
  }
  const u = (payload as { u?: unknown } | null)?.u;
  if (typeof u !== "string") throw new Error("invalid_mock_token");
  const username = assertUsername(u);
  return {
    id: `sl_${username}`,
    name: username,
    email: `${username}@streamlabs.mock`,
    emailVerified: true,
  };
}
