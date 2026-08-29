import { describe, expect, it, beforeAll } from "vitest";
import { randomBytes } from "crypto";
import { decryptSecret, encryptSecret } from "../crypto";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext string", () => {
    const original = "gho_exampleGithubAccessToken1234567890";
    const encrypted = encryptSecret(original);
    expect(encrypted).not.toContain(original);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  it("throws on a tampered payload", () => {
    const encrypted = encryptSecret("sensitive-value");
    const tampered = encrypted.slice(0, -4) + "abcd";
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws on a malformed payload", () => {
    expect(() => decryptSecret("not-a-valid-payload")).toThrow();
  });
});
