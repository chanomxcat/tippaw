import { describe, expect, it } from "vitest";

import {
  buildAuthorizeRedirect,
  exchangeCode,
  isAllowedRedirectUri,
  userInfo,
} from "@/server/auth/mock-streamlabs";

const REDIRECT = "http://localhost:8787/api/auth/callback/streamlabs";

describe("mock streamlabs", () => {
  it("round-trips authorize code -> token -> userinfo", () => {
    const url = new URL(
      buildAuthorizeRedirect({ redirectUri: REDIRECT, state: "st-123", streamlabsUsername: "catstreamer" }),
    );
    const code = url.searchParams.get("code");
    expect(code).toBeTruthy();

    const { accessToken } = exchangeCode(code!);
    expect(accessToken).toBe(`mock_${code}`);

    expect(userInfo(accessToken)).toEqual({
      id: "sl_catstreamer",
      name: "catstreamer",
      email: "catstreamer@streamlabs.mock",
      emailVerified: true,
    });
  });

  it("keeps the original state and redirect target", () => {
    const url = new URL(
      buildAuthorizeRedirect({ redirectUri: REDIRECT, state: "st-123", streamlabsUsername: "catstreamer" }),
    );
    expect(url.searchParams.get("state")).toBe("st-123");
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT);
  });

  it("encodes the code as base64url JSON { u }", () => {
    const url = new URL(
      buildAuthorizeRedirect({ redirectUri: REDIRECT, state: "s", streamlabsUsername: "catstreamer" }),
    );
    const code = url.searchParams.get("code")!;
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const json = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    expect(JSON.parse(json)).toEqual({ u: "catstreamer" });
  });

  it("rejects tokens that were not issued by the mock", () => {
    expect(() => userInfo("not-a-mock-token")).toThrow();
    expect(() => userInfo("mock_%%%")).toThrow();
  });

  it("rejects invalid streamlabs usernames", () => {
    expect(() =>
      buildAuthorizeRedirect({ redirectUri: REDIRECT, state: "s", streamlabsUsername: "  " }),
    ).toThrow();
    expect(() =>
      buildAuthorizeRedirect({ redirectUri: REDIRECT, state: "s", streamlabsUsername: "bad name@x" }),
    ).toThrow();
  });
});

describe("isAllowedRedirectUri", () => {
  const base = "http://localhost:8787";

  it("allows redirect URIs on the BETTER_AUTH_URL origin", () => {
    expect(isAllowedRedirectUri(REDIRECT, base)).toBe(true);
  });

  it("rejects other origins (open redirect)", () => {
    expect(isAllowedRedirectUri("https://evil.example/cb", base)).toBe(false);
    expect(isAllowedRedirectUri("http://localhost:9999/cb", base)).toBe(false);
    expect(isAllowedRedirectUri("https://localhost:8787/cb", base)).toBe(false);
    expect(isAllowedRedirectUri("http://localhost:8787.evil.example/cb", base)).toBe(false);
  });

  it("rejects relative / malformed URIs", () => {
    expect(isAllowedRedirectUri("/api/auth/callback", base)).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)", base)).toBe(false);
    expect(isAllowedRedirectUri("", base)).toBe(false);
  });
});
