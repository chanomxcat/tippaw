import { describe, expect, it } from "vitest";

import { bangkokEndOfDay } from "@/server/lib/time";

describe("bangkokEndOfDay", () => {
  it("converts a date-only string to 23:59:59.999 Asia/Bangkok (UTC+7), not UTC midnight", () => {
    const result = bangkokEndOfDay("2026-01-15");
    expect(result).not.toBeNull();
    // 23:59:59.999 +07:00 on 2026-01-15 is 16:59:59.999 UTC the same day.
    expect(result!.toISOString()).toBe("2026-01-15T16:59:59.999Z");
  });

  it("lands later in the day than the old `new Date(dateOnly)` (UTC midnight) behavior", () => {
    // The old code did `new Date(expiresAt).toISOString()` on the raw
    // "YYYY-MM-DD" string, which parses as UTC midnight — 07:00 Bangkok
    // time on the *same* day, so an invite "expiring on" that date was
    // already treated as expired for the last ~17 hours of the Thai day.
    const oldBehavior = new Date("2026-01-15");
    const fixed = bangkokEndOfDay("2026-01-15")!;
    expect(fixed.getTime()).toBeGreaterThan(oldBehavior.getTime());
  });

  it("returns null for a non-date-only string", () => {
    expect(bangkokEndOfDay("2026-01-15T00:00:00.000Z")).toBeNull();
    expect(bangkokEndOfDay("not-a-date")).toBeNull();
    expect(bangkokEndOfDay("")).toBeNull();
  });
});
