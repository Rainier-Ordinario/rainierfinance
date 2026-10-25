import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Plaid access tokens never expire, so they're encrypted at rest with a key
// that lives only in the server's environment, not in the database.

function key(): Buffer {
  const raw = process.env.PLAID_TOKEN_KEY ?? "";
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "PLAID_TOKEN_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)"
    );
  }
  return buf;
}

/** AES-256-GCM; output is base64 of iv(12) | tag(16) | ciphertext. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptToken(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buf.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
