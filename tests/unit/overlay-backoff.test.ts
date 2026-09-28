import { describe, expect, it } from "vitest";

import { nextDelay } from "@/overlay/backoff";

describe("nextDelay", () => {
  it("starts at 1000ms", () => {
    expect(nextDelay(0)).toBe(1000);
  });

  it("doubles per attempt", () => {
    expect(nextDelay(4)).toBe(16_000);
  });

  it("caps at 30000ms", () => {
    expect(nextDelay(5)).toBe(30_000);
    expect(nextDelay(20)).toBe(30_000);
  });
});
