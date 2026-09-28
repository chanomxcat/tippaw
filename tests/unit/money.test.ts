import { describe, expect, it } from "vitest";
import { formatThb, thbToSatang } from "@/server/lib/money";

describe("thbToSatang", () => {
  it("converts whole baht to satang", () => {
    expect(thbToSatang(10)).toBe(1000);
  });
});

describe("formatThb", () => {
  it("formats whole baht amounts without decimals", () => {
    expect(formatThb(123400)).toBe("1,234");
  });

  it("formats fractional baht amounts with exactly 2 decimals", () => {
    expect(formatThb(150)).toBe("1.50");
  });
});
