import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/plaid/crypto";

describe("token encryption", () => {
  const original = process.env.PLAID_TOKEN_KEY;
  beforeEach(() => {
    process.env.PLAID_TOKEN_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    process.env.PLAID_TOKEN_KEY = original;
  });

  it("round-trips and never stores the token in the clear", () => {
    const token = "access-sandbox-1234";
    const sealed = encryptToken(token);
    expect(sealed).not.toContain(token);
    expect(encryptToken(token)).not.toBe(sealed);
    expect(decryptToken(sealed)).toBe(token);
  });

  it("rejects a tampered token", () => {
    const sealed = Buffer.from(encryptToken("access-sandbox-1234"), "base64");
    sealed[sealed.length - 1] ^= 1;
    expect(() => decryptToken(sealed.toString("base64"))).toThrow();
  });

  it("refuses to run without a proper key", () => {
    process.env.PLAID_TOKEN_KEY = "short";
    expect(() => encryptToken("x")).toThrow(/PLAID_TOKEN_KEY/);
  });
});
