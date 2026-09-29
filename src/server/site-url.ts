import type { Deps } from "@/server/env";

const FALLBACK_URL = "https://tippaw.workers.dev";

/** `env.BETTER_AUTH_URL` as a validated absolute URL string, falling back when unset/invalid (e.g. at build time). */
export function getSiteUrl(deps: Deps): string {
  try {
    return new URL(deps.env.BETTER_AUTH_URL).toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_URL;
  }
}
