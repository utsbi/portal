import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM envelope format: "enc:v1:<iv_hex>:<authtag_hex>:<ciphertext_hex>"
// The prefix makes legacy-plaintext detection unambiguous.
const ENVELOPE_PREFIX = "enc:v1:";
const IV_BYTES = 12; // 96-bit IV is the GCM standard
const TAG_BYTES = 16; // 128-bit auth tag

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Missing env var: TOKEN_ENCRYPTION_KEY — cannot encrypt/decrypt OAuth tokens",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/**
 * Encrypts a plaintext OAuth token and returns an AES-256-GCM envelope string.
 * Throws if TOKEN_ENCRYPTION_KEY is missing or the wrong length.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Unexpected auth tag length: ${tag.length}`);
  }
  return (
    ENVELOPE_PREFIX +
    iv.toString("hex") +
    ":" +
    tag.toString("hex") +
    ":" +
    ct.toString("hex")
  );
}

/**
 * Decrypts an AES-256-GCM envelope produced by encryptToken.
 *
 * Legacy-plaintext transition shim: rows written before encryption was
 * introduced are stored without the "enc:v1:" prefix. Those values are
 * returned as-is so already-connected users aren't broken while the
 * new format rolls out. All NEW writes always go through encryptToken.
 *
 * TODO: after a backfill script re-encrypts every row in profiles.config.google
 * that still holds a plaintext token, remove this shim and make the prefix
 * a hard requirement. The backfill is a one-release migration:
 *   SELECT id, config FROM profiles WHERE config->'google'->>'refresh_token' IS NOT NULL
 *   -- then encryptToken each value and UPDATE config.
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(ENVELOPE_PREFIX)) {
    // Legacy plaintext — not yet encrypted. Return verbatim.
    return stored;
  }

  const key = getKey();
  const inner = stored.slice(ENVELOPE_PREFIX.length);
  const parts = inner.split(":");
  if (parts.length !== 3) {
    throw new Error(
      `Malformed encrypted token envelope (expected 3 colon-separated parts, got ${parts.length})`,
    );
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}
