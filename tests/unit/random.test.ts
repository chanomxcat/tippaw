import { describe, expect, it } from "vitest";
import { normalizeInviteCode, randomInviteCode, randomToken } from "@/server/lib/random";

describe("randomToken", () => {
  it("returns a 43-character base64url token", () => {
    const token = randomToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns different tokens on each call", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("randomInviteCode", () => {
  it("matches the expected alphabet and length across many samples", () => {
    for (let i = 0; i < 1000; i++) {
      expect(randomInviteCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});

describe("normalizeInviteCode", () => {
  it("trims and upper-cases a valid code", () => {
    expect(normalizeInviteCode(" vip-2026 ")).toBe("VIP-2026");
  });

  it("returns null for a code shorter than 4 characters", () => {
    expect(normalizeInviteCode("ab")).toBeNull();
  });

  it("returns null for a code with non-ASCII characters", () => {
    expect(normalizeInviteCode("ไทย1234")).toBeNull();
  });
});
