import { describe, expect, it } from "vitest";

import { tipPageUpdateSchema } from "@/server/tip-page/tip-page";

const base = {
  channelName: "My Channel",
  links: [] as { label: string; url: string }[],
  successMessage: "ขอบคุณสำหรับการสนับสนุนนะ",
  failureMessage: "การชำระเงินไม่สำเร็จ",
};

describe("tipPageUpdateSchema", () => {
  it("accepts valid input", () => {
    expect(tipPageUpdateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a link URL that isn't https://", () => {
    const result = tipPageUpdateSchema.safeParse({
      ...base,
      links: [{ label: "Twitter", url: "http://twitter.com/me" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 10 links", () => {
    const links = Array.from({ length: 10 }, (_, i) => ({ label: `L${i}`, url: "https://example.com" }));
    expect(tipPageUpdateSchema.safeParse({ ...base, links }).success).toBe(true);
  });

  it("rejects 11 links", () => {
    const links = Array.from({ length: 11 }, (_, i) => ({ label: `L${i}`, url: "https://example.com" }));
    expect(tipPageUpdateSchema.safeParse({ ...base, links }).success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = tipPageUpdateSchema.safeParse({
      ...base,
      links: [{ label: "", url: "https://example.com" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a label over 30 code points", () => {
    const result = tipPageUpdateSchema.safeParse({
      ...base,
      links: [{ label: "x".repeat(31), url: "https://example.com" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty channelName", () => {
    expect(tipPageUpdateSchema.safeParse({ ...base, channelName: "" }).success).toBe(false);
  });

  it("rejects a channelName over 50 code points", () => {
    expect(tipPageUpdateSchema.safeParse({ ...base, channelName: "x".repeat(51) }).success).toBe(false);
  });

  it("rejects an empty successMessage or failureMessage", () => {
    expect(tipPageUpdateSchema.safeParse({ ...base, successMessage: "" }).success).toBe(false);
    expect(tipPageUpdateSchema.safeParse({ ...base, failureMessage: "" }).success).toBe(false);
  });

  it("rejects a successMessage/failureMessage over 300 code points", () => {
    expect(tipPageUpdateSchema.safeParse({ ...base, successMessage: "x".repeat(301) }).success).toBe(false);
  });
});
