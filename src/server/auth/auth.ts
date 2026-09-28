import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { genericOAuth, type GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

import * as schema from "@/server/db/schema";
import { isMockMode, type AppEnv, type Db } from "@/server/env";

import { exchangeCode, userInfo } from "./mock-streamlabs";
import { hashPassword, verifyPassword } from "./pbkdf2";

/** The username plugin still requires an email; local sign-ups get a non-routable one. */
export function placeholderEmail(name: string): string {
  return `${name.toLowerCase()}@users.tippaw.invalid`;
}

function streamlabsConfig(env: AppEnv): GenericOAuthConfig | null {
  if (isMockMode(env)) {
    return {
      providerId: "streamlabs",
      name: "Streamlabs",
      clientId: env.STREAMLABS_CLIENT_ID ?? "mock-client",
      clientSecret: env.STREAMLABS_CLIENT_SECRET ?? "mock-secret",
      authorizationUrl:
        env.STREAMLABS_AUTHORIZE_URL ?? new URL("/mock/streamlabs/authorize", env.BETTER_AUTH_URL).toString(),
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
