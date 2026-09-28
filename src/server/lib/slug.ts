/** Slugs that collide with existing routes or reserved product terms. */
export const RESERVED_SLUGS: readonly string[] = [
  "dashboard",
  "login",
  "register",
  "onboarding",
  "admin",
  "overlay",
  "api",
  "mock",
  "_next",
  "assets",
  "presets",
  "settings",
  "help",
  "about",
  "terms",
  "privacy",
  "tippaw",
  "result",
  "gift",
];

const SLUG_FORMAT = /^[a-z0-9-]{3,30}$/;

/** Trims and lower-cases a slug candidate, ahead of format/reserved validation. */
export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "format" | "reserved" };

export function validateSlug(input: string): SlugValidationResult {
  const slug = normalizeSlug(input);
  if (!SLUG_FORMAT.test(slug)) {
    return { ok: false, reason: "format" };
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true, slug };
}
