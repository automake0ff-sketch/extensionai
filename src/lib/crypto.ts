import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for secrets that must be stored (not just hashed) —
 * currently only the GitHub OAuth access token (lib/github). Firestore
 * documents are only ever written/read via the Admin SDK, but encrypting at
 * rest means a leaked Firestore export or a misconfigured rule still
 * doesn't hand over usable GitHub credentials.
 *
 * APP_ENCRYPTION_KEY must be a 32-byte key, base64-encoded (see
 * .env.example for how to generate one).
 */
function getKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` (see .env.example)."
    );
  }
  const buffer = Buffer.from(key, "base64");
  if (buffer.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return buffer;
}

/** Returns a single opaque string safe to store in a Firestore field. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
