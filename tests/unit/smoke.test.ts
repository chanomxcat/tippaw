import { describe, expect, it } from "vitest";
import { isMockMode, isStreamlabsMockLoginEnabled } from "@/server/env";
import type { AppEnv } from "@/server/env";

describe("isMockMode", () => {
  it("returns true when MOCK_MODE is 'true'", () => {
    expect(isMockMode({ MOCK_MODE: "true" } as AppEnv)).toBe(true);
  });

  it("returns false when MOCK_MODE is 'false'", () => {
    expect(isMockMode({ MOCK_MODE: "false" } as AppEnv)).toBe(false);
  });
});

describe("isStreamlabsMockLoginEnabled", () => {
  it("requires both MOCK_MODE and MOCK_STREAMLABS_LOGIN to be 'true'", () => {
    expect(
      isStreamlabsMockLoginEnabled({ MOCK_MODE: "true", MOCK_STREAMLABS_LOGIN: "true" } as AppEnv),
    ).toBe(true);
  });

  it("is disabled when MOCK_MODE is true but the flag is unset (deploy-safety default)", () => {
    expect(isStreamlabsMockLoginEnabled({ MOCK_MODE: "true" } as AppEnv)).toBe(false);
  });

  it("is disabled when MOCK_MODE is false, even if the flag is 'true'", () => {
    expect(
      isStreamlabsMockLoginEnabled({ MOCK_MODE: "false", MOCK_STREAMLABS_LOGIN: "true" } as AppEnv),
    ).toBe(false);
  });
});
