import { describe, expect, it } from "vitest";
import { isMockMode } from "@/server/env";
import type { AppEnv } from "@/server/env";

describe("isMockMode", () => {
  it("returns true when MOCK_MODE is 'true'", () => {
    expect(isMockMode({ MOCK_MODE: "true" } as AppEnv)).toBe(true);
  });

  it("returns false when MOCK_MODE is 'false'", () => {
    expect(isMockMode({ MOCK_MODE: "false" } as AppEnv)).toBe(false);
  });
});
