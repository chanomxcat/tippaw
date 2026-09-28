import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("realtime route stub", () => {
  it("responds 404 for unknown realtime paths", async () => {
    const response = await SELF.fetch("http://x/api/realtime/nope");
    expect(response.status).toBe(404);
  });
});
