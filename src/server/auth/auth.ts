import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, username } from "better-auth/plugins";
import { genericOAuth, type GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

import * as schema from "@/server/db/schema";
import { isMockMode, isStreamlabsMockLoginEnabled, type AppEnv, type Db } from "@/server/env";

import { exchangeCode, userInfo } from "./mock-streamlabs";
import { hashPassword, verifyPassword } from "./pbkdf2";

/** The username plugin still requires an email; local sign-ups get a non-routable one. */
export function placeholderEmail(name: string): string {
  return `${name.toLowerCase()}@users.tippaw.invalid`;
}

/**
 * Local (credential) accounts must be `username` + `placeholderEmail(username)`.
 * Otherwise anyone could pre-register a victim's real email with their own
 * password and have it auto-linked when the victim later signs in with Google.
 * OAuth user creation does not go through /sign-up/email, so it is unaffected.
 */
const enforcePlaceholderSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-up/email") return;
  const body = (ctx.body ?? {}) as { username?: unknown; email?: unknown };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    throw new APIError("BAD_REQUEST", { message: "username_required" });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email !== placeholderEmail(username)) {
    throw new APIError("BAD_REQUEST", { message: "invalid_email" });
  }
});

function streamlabsConfig(env: AppEnv): GenericOAuthConfig | null {
  if (isMockMode(env)) {
    // The mock login is unauthenticated (typing any name signs in as that
    // streamer), so it additionally requires MOCK_STREAMLABS_LOGIN=true —
    // see isStreamlabsMockLoginEnabled. Without it, no streamlabs provider
    // is registered at all (sign-in attempts 404), same as the real branch
    // below with no client id configured.
    if (!isStreamlabsMockLoginEnabled(env)) return null;
    return {
      providerId: "streamlabs",
      name: "Streamlabs",
      clientId: env.STREAMLABS_CLIENT_ID ?? "mock-client",
      clientSecret: env.STREAMLABS_CLIENT_SECRET ?? "mock-secret",
      // Always the local mock path — never STREAMLABS_AUTHORIZE_URL. That
      // var is for the real Streamlabs endpoint (see .dev.vars.example);
      // honoring it here in mock mode would silently send users to a
      // real/placeholder URL instead of the in-process mock page.
      authorizationUrl: new URL("/mock/streamlabs/authorize", env.BETTER_AUTH_URL).toString(),
      // No self-fetch on Workers: token + userinfo are resolved in-process.
      getToken: async ({ code }) => exchangeCode(code),
      getUserInfo: async (tokens) => (tokens.accessToken ? userInfo(tokens.accessToken) : null),
    };
  }

  if (
    !env.STREAMLABS_CLIENT_ID ||
    !env.STREAMLABS_AUTHORIZE_URL ||
    !env.STREAMLABS_TOKEN_URL ||
    !env.STREAMLABS_USERINFO_URL
  ) {
    return null;
  }
  return {
    providerId: "streamlabs",
    name: "Streamlabs",
    clientId: env.STREAMLABS_CLIENT_ID,
    clientSecret: env.STREAMLABS_CLIENT_SECRET,
    authorizationUrl: env.STREAMLABS_AUTHORIZE_URL,
    tokenUrl: env.STREAMLABS_TOKEN_URL,
    userInfoUrl: env.STREAMLABS_USERINFO_URL,
  };
}

/** Whether the "เข้าสู่ระบบด้วย Streamlabs" button should be shown — mirrors streamlabsConfig's own gating (mock login flag in mock mode, real client config otherwise). */
export function isStreamlabsConfigured(env: AppEnv): boolean {
  return streamlabsConfig(env) !== null;
}

/**
 * Pure factory: build one instance per request from that request's bindings
 * (Workers bindings are per-request), or directly in tests.
 */
export function createAuth(env: AppEnv, db: Db) {
  const streamlabs = streamlabsConfig(env);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    // Login is username-only; email sign-in would bypass that.
    disabledPaths: ["/sign-in/email"],
    hooks: { before: enforcePlaceholderSignUp },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    socialProviders: env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
          },
        }
      : {},
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    plugins: [
      username(),
      admin({ defaultRole: "streamer", adminRoles: ["admin"] }),
      genericOAuth({ config: streamlabs ? [streamlabs] : [] }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
