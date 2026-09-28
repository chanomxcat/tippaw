import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, normalizeSlug, validateSlug } from "@/server/lib/slug";

describe("normalizeSlug", () => {
  it("trims and lower-cases the input", () => {
    expect(normalizeSlug("  MyChannel ")).toBe("mychannel");
  });
});

describe("RESERVED_SLUGS", () => {
  it("includes the reserved words from the spec", () => {
    expect(RESERVED_SLUGS).toEqual([
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
    ]);
  });
});

describe("validateSlug", () => {
  it("normalizes and accepts a valid slug", () => {
    expect(validateSlug("  MyChannel ")).toEqual({ ok: true, slug: "mychannel" });
  });

  it("rejects a slug shorter than 3 characters as format", () => {
    expect(validateSlug("ab")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects a slug with characters outside [a-z0-9-] as format", () => {
    expect(validateSlug("a_b-c")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects a reserved word", () => {
    expect(validateSlug("Dashboard")).toEqual({ ok: false, reason: "reserved" });
  });

  it("rejects a slug longer than 30 characters as format", () => {
    expect(validateSlug("x".repeat(31))).toEqual({ ok: false, reason: "format" });
  });
});
