import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("realtime route", () => {
  it("responds 404 for an unknown overlay token", async () => {
    const response = await SELF.fetch("http://x/api/realtime/nope", {
      headers: { Upgrade: "websocket" },
    });
    expect(response.status).toBe(404);
  });
});
