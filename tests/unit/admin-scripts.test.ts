import { describe, expect, it } from "vitest";

import {
  parseArgs as parseBootstrapArgs,
} from "../../scripts/admin-bootstrap-invite";
import {
  normalizeUsername,
  parseArgs as parsePromoteArgs,
  parseChangedCount,
} from "../../scripts/admin-promote";

describe("admin-promote parseArgs", () => {
  it("reads a bare username", () => {
    expect(parsePromoteArgs(["neko"])).toEqual({ username: "neko", remote: false });
  });

  it("reads --remote alongside the username, in either order", () => {
    expect(parsePromoteArgs(["neko", "--remote"])).toEqual({ username: "neko", remote: true });
    expect(parsePromoteArgs(["--remote", "neko"])).toEqual({ username: "neko", remote: true });
  });
});

describe("admin-promote normalizeUsername", () => {
  it("lowercases the username so it matches Better Auth's stored (lowercased) value", () => {
    expect(normalizeUsername("NekoStreamer")).toBe("nekostreamer");
  });
});

describe("admin-promote parseChangedCount", () => {
  it("reads the changed count from the trailing SELECT changes() statement", () => {
    const rows = [
      { results: [], success: true, meta: {} },
      { results: [{ changed: 1 }], success: true, meta: {} },
    ];
    expect(parseChangedCount(rows)).toBe(1);
  });

  it("returns 0 when no rows changed (no user matched)", () => {
    const rows = [
      { results: [], success: true, meta: {} },
      { results: [{ changed: 0 }], success: true, meta: {} },
    ];
    expect(parseChangedCount(rows)).toBe(0);
  });

  it("returns 0 for malformed/empty output instead of throwing", () => {
    expect(parseChangedCount([])).toBe(0);
  });
});

describe("admin-bootstrap-invite parseArgs", () => {
  it("reads a --code value", () => {
    expect(parseBootstrapArgs(["--code", "MY-CODE"])).toEqual({
      remote: false,
      code: "MY-CODE",
      codeMissingValue: false,
    });
  });

  it("flags a bare --code at the end of argv as missing a value", () => {
    expect(parseBootstrapArgs(["--code"])).toEqual({
      remote: false,
      code: undefined,
      codeMissingValue: true,
    });
  });

  it("flags --code immediately followed by another flag as missing a value", () => {
    expect(parseBootstrapArgs(["--code", "--remote"])).toEqual({
      remote: true,
      code: undefined,
      codeMissingValue: true,
    });
  });

  it("reads --remote with no --code at all", () => {
    expect(parseBootstrapArgs(["--remote"])).toEqual({
      remote: true,
      code: undefined,
      codeMissingValue: false,
    });
  });
});
