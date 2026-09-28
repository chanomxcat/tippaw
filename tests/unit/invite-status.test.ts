import { describe, expect, it } from "vitest";

import { inviteStatusLabel } from "@/server/admin/invite-status";

const NOW = new Date("2026-06-15T00:00:00Z");

describe("inviteStatusLabel", () => {
  it("returns 'ปิดอยู่' when disabled, regardless of other fields", () => {
    expect(
      inviteStatusLabel(
        { disabledAt: new Date(), expiresAt: null, maxUses: null, usedCount: 0 },
        NOW,
      ),
    ).toBe("ปิดอยู่");
  });

  it("returns 'หมดอายุ' when expiresAt is in the past", () => {
    expect(
      inviteStatusLabel(
        { disabledAt: null, expiresAt: new Date("2026-01-01T00:00:00Z"), maxUses: null, usedCount: 0 },
        NOW,
      ),
    ).toBe("หมดอายุ");
  });

  it("treats expiresAt exactly equal to now as expired", () => {
    expect(
      inviteStatusLabel({ disabledAt: null, expiresAt: NOW, maxUses: null, usedCount: 0 }, NOW),
    ).toBe("หมดอายุ");
  });

  it("returns 'เต็ม' when usedCount reaches maxUses", () => {
    expect(
      inviteStatusLabel({ disabledAt: null, expiresAt: null, maxUses: 3, usedCount: 3 }, NOW),
    ).toBe("เต็ม");
  });

  it("returns 'ใช้งานได้' for an unlimited, non-expired, enabled code", () => {
    expect(
      inviteStatusLabel({ disabledAt: null, expiresAt: null, maxUses: null, usedCount: 5 }, NOW),
    ).toBe("ใช้งานได้");
  });

  it("returns 'ใช้งานได้' when usedCount is below maxUses", () => {
    expect(
      inviteStatusLabel({ disabledAt: null, expiresAt: null, maxUses: 3, usedCount: 2 }, NOW),
    ).toBe("ใช้งานได้");
  });
});
