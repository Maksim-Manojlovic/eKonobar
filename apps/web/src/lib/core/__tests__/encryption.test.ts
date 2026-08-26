import { describe, it, expect, vi, beforeEach } from "vitest";

// encryptToken/decryptToken read MONRI_TOKEN_ENCRYPTION_KEY at call time via getKey(),
// but getKey() itself is module-level only in the sense that it reads process.env each call.
// We can stub + resetModules to get a fresh module with the key set.

const VALID_KEY = "a".repeat(64); // 64 hex chars = 32 bytes, valid AES-256 key

describe("encryptToken / decryptToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("round-trips plaintext when key is set", async () => {
    vi.stubEnv("MONRI_TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const { encryptToken, decryptToken } = await import("../encryption");

    const plaintext = "tok_monri_abc123";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3); // iv:tag:ciphertext
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("no-op when key is not set", async () => {
    // MONRI_TOKEN_ENCRYPTION_KEY not set
    const { encryptToken, decryptToken } = await import("../encryption");

    const plaintext = "tok_monri_abc123";
    expect(encryptToken(plaintext)).toBe(plaintext);
    expect(decryptToken(plaintext)).toBe(plaintext);
  });

  it("different ciphertexts for same plaintext (random IV)", async () => {
    vi.stubEnv("MONRI_TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const { encryptToken } = await import("../encryption");

    const a = encryptToken("same-token");
    const b = encryptToken("same-token");
    expect(a).not.toBe(b); // IVs differ
  });

  it("decryptToken handles pre-encryption plaintext (migration window)", async () => {
    vi.stubEnv("MONRI_TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const { decryptToken } = await import("../encryption");

    // A value that was stored before encryption was enabled (no colons)
    const legacy = "old_plain_token";
    expect(decryptToken(legacy)).toBe(legacy);
  });

  it("throws on bad key format", async () => {
    vi.stubEnv("MONRI_TOKEN_ENCRYPTION_KEY", "tooshort");
    const { encryptToken } = await import("../encryption");
    expect(() => encryptToken("x")).toThrow(/64 hex/);
  });

  it("throws on tampered ciphertext (auth tag mismatch)", async () => {
    vi.stubEnv("MONRI_TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const { encryptToken, decryptToken } = await import("../encryption");

    const encrypted = encryptToken("real-token");
    const [iv, tag, ct] = encrypted.split(":");
    // Flip last hex char — guaranteed different value (0↔f conditional swap)
    const lastChar  = ct.slice(-1);
    const flipped   = lastChar === "f" ? "0" : "f";
    const tampered  = `${iv}:${tag}:${ct.slice(0, -1)}${flipped}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
