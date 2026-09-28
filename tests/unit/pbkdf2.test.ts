import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/pbkdf2";

describe("pbkdf2 password hasher", () => {
  it("produces the pbkdf2$sha256$100000$<salt>$<hash> format", async () => {
    const hash = await hashPassword("password123");
    const parts = hash.split("$");
    expect(parts).toHaveLength(5);
    expect(parts.slice(0, 3)).toEqual(["pbkdf2", "sha256", "100000"]);
    expect(atob(parts[3]!)).toHaveLength(16);
    expect(atob(parts[4]!)).toHaveLength(32);
  });

  it("round-trips a correct password", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword({ hash, password: "password123" })).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword({ hash, password: "password124" })).resolves.toBe(false);
  });

  it("salts: hashing the same password twice gives different hashes", async () => {
    const a = await hashPassword("password123");
    const b = await hashPassword("password123");
    expect(a).not.toBe(b);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    await expect(verifyPassword({ hash: "garbage", password: "x" })).resolves.toBe(false);
    await expect(
      verifyPassword({ hash: "pbkdf2$sha1$100000$AAAA$AAAA", password: "x" }),
    ).resolves.toBe(false);
  });
});
