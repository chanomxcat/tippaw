import { describe, expect, it } from "vitest";

import { donationInputSchema } from "@/server/donations/create-donation";
import type { AppEnv } from "@/server/env";

const env = { MIN_DONATION_THB: "10", MAX_DONATION_THB: "10000" } as AppEnv;
const schema = donationInputSchema(env);

function base(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: "streamer-1",
    donorName: "แมว",
    message: "",
    amountThb: 100,
    ...overrides,
  };
}

describe("donationInputSchema", () => {
  it("accepts a 50 code point donorName", () => {
    expect(schema.safeParse(base({ donorName: "ก".repeat(50) })).success).toBe(true);
  });

  it("rejects a 51 code point donorName", () => {
    expect(schema.safeParse(base({ donorName: "ก".repeat(51) })).success).toBe(false);
  });

  it("accepts a donorName whose .length differs from its code point count but is still 50", () => {
    const name = "น้ำใจ".repeat(10);
    expect(name.length).toBe(50);
    expect(schema.safeParse(base({ donorName: name })).success).toBe(true);
  });

  it("rejects one code point over that same boundary", () => {
    const name = "น้ำใจ".repeat(10) + "ก";
    expect(schema.safeParse(base({ donorName: name })).success).toBe(false);
  });

  it("accepts 50 emoji (100 UTF-16 code units, 50 code points)", () => {
    const name = "😀".repeat(50);
    expect(name.length).toBe(100);
    expect(schema.safeParse(base({ donorName: name })).success).toBe(true);
  });

  it("rejects a whitespace-only donorName", () => {
    expect(schema.safeParse(base({ donorName: "   " })).success).toBe(false);
  });

  it("rejects amountThb below the minimum", () => {
    expect(schema.safeParse(base({ amountThb: 9 })).success).toBe(false);
  });

  it("rejects amountThb above the maximum", () => {
    expect(schema.safeParse(base({ amountThb: 10001 })).success).toBe(false);
  });

  it("rejects a non-integer amountThb", () => {
    expect(schema.safeParse(base({ amountThb: 10.5 })).success).toBe(false);
  });

  it("accepts amountThb at the minimum boundary", () => {
    expect(schema.safeParse(base({ amountThb: 10 })).success).toBe(true);
  });

  it("accepts amountThb at the maximum boundary", () => {
    expect(schema.safeParse(base({ amountThb: 10000 })).success).toBe(true);
  });

  it("defaults message to an empty string when omitted", () => {
    const result = schema.safeParse(base({ message: undefined }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("");
    }
  });

  it("rejects a message over 200 code points", () => {
    expect(schema.safeParse(base({ message: "ก".repeat(201) })).success).toBe(false);
  });
});
