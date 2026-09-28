import { describe, expect, it } from "vitest";
import { charLength, maxChars } from "@/server/lib/text";

describe("charLength", () => {
  it("counts an emoji as a single code point", () => {
    expect(charLength("😀")).toBe(1);
  });

  it("counts Thai combining characters as separate code points", () => {
    expect(charLength("น้ำ")).toBe(3);
  });
});

describe("maxChars", () => {
  it("accepts a string within the code-point limit", () => {
    const schema = maxChars(3);
    expect(schema.safeParse("abc").success).toBe(true);
  });

  it("rejects a string over the code-point limit, counted by code points", () => {
    const schema = maxChars(1);
    expect(schema.safeParse("😀😀").success).toBe(false);
  });

  it("counts an emoji as a single code point when validating the limit", () => {
    const schema = maxChars(1);
    expect(schema.safeParse("😀").success).toBe(true);
  });

  it("trims input before validating", () => {
    const schema = maxChars(3);
    expect(schema.safeParse("  abc  ").success).toBe(true);
  });
});
