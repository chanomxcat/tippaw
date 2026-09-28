import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StreamerRoom } from "./realtime/streamer-room";

export type AppEnv = {
  DB: D1Database;
  STREAMER_ROOM: DurableObjectNamespace<StreamerRoom>;
  DONATION_RATE_LIMITER: RateLimit;
  INVITE_RATE_LIMITER: RateLimit;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STREAMLABS_CLIENT_ID?: string;
  STREAMLABS_CLIENT_SECRET?: string;
  STREAMLABS_AUTHORIZE_URL?: string;
  STREAMLABS_TOKEN_URL?: string;
  STREAMLABS_USERINFO_URL?: string;
  MOCK_MODE: string;
  PAYMENT_PROVIDER: "mock" | "stripe";
  MOCK_WEBHOOK_SECRET: string;
  MIN_DONATION_THB: string;
  MAX_DONATION_THB: string;
};

/**
 * Placeholder for the Drizzle database handle. Task 2 introduces
 * `createDb(env: AppEnv): Db` and replaces this alias with the real type.
 */
export type Db = unknown;

export type Deps = {
  env: AppEnv;
  db: Db;
  now: () => Date;
};

/**
 * The only place in `src/server/**` allowed to call `getCloudflareContext()`.
 * Services must receive `Deps` as a parameter instead, so they stay testable
 * under vitest-pool-workers (`@cloudflare/vitest-plugin`).
 */
export async function getDeps(): Promise<Deps> {
  const { env } = await getCloudflareContext({ async: true });
  return {
    env: env as unknown as AppEnv,
    // TODO(Task 2): replace with createDb(env)
    db: undefined as Db,
    now: () => new Date(),
  };
}

export function isMockMode(env: AppEnv): boolean {
  return env.MOCK_MODE === "true";
}
