import crypto from "crypto";

// ── Field-level AES-256-GCM encryption for sensitive stored values ────────────
//
// Used for: WaiterPassport.monriPanToken, PassportPayment.monriPanToken
//
// Env var: MONRI_TOKEN_ENCRYPTION_KEY — 64 hex chars (32 bytes / 256 bits).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// If the key is not set (development / CI), functions are no-ops so dev/test
// environments work without real credentials.  Set the key in production.
//
// Storage format: "<iv_hex>:<authtag_hex>:<ciphertext_hex>"
// All three segments are lowercase hex; colons act as delimiters.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES   = 12; // 96-bit IV — recommended for GCM
const TAG_BYTES  = 16; // 128-bit auth tag

function getKey(): Buffer | null {
  const raw = process.env.MONRI_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  if (raw.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "MONRI_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypts `plaintext` with AES-256-GCM.
 * Returns `"<iv>:<tag>:<ciphertext>"` (hex).
 * Returns `plaintext` unchanged when MONRI_TOKEN_ENCRYPTION_KEY is not set.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // no-op in dev

  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/**
 * Decrypts a value produced by `encryptToken`.
 * Returns the original plaintext.
 * Returns `ciphertext` unchanged when MONRI_TOKEN_ENCRYPTION_KEY is not set
 * (mirrors the no-op encrypt behaviour so dev tokens round-trip cleanly).
 * Throws on auth-tag mismatch (tampered data).
 */
export function decryptToken(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext; // no-op in dev

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    // Value was stored before encryption was enabled — return as-is.
    // This handles the migration window where some rows are still plaintext.
    return ciphertext;
  }

  const [ivHex, tagHex, encHex] = parts;
  const iv      = Buffer.from(ivHex,  "hex");
  const tag     = Buffer.from(tagHex, "hex");
  const encData = Buffer.from(encHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encData), decipher.final()]).toString("utf8");
}
