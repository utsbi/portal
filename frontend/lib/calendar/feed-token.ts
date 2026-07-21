import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Per-user calendar feed capability token.
 *
 * The token is a 32-byte URL-safe random string. We never store the plaintext;
 * only its SHA-256 hash lives on `profiles.config.calendar_feed_token_hash`.
 * Lookups compare hashes (constant-time). Rotate invalidates the old token
 * without leaving a window where two tokens work.
 */
export interface FeedToken {
  /** Plaintext token, returned exactly once when generated/rotated. */
  plaintext: string;
  /** SHA-256 hex of the plaintext. Store this; discard the plaintext after display. */
  hash: string;
}

const TOKEN_BYTES = 32;

function toUrlSafeBase64(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateFeedToken(): FeedToken {
  const plaintext = toUrlSafeBase64(randomBytes(TOKEN_BYTES));
  return { plaintext, hash: hashToken(plaintext) };
}

export function hashFeedToken(plaintext: string): string {
  return hashToken(plaintext);
}

/** Constant-time string comparison (length-equal). Falls back to length match first. */
export function feedTokenMatches(
  plaintext: string,
  expectedHash: string,
): boolean {
  const actual = hashToken(plaintext);
  if (actual.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) {
    mismatch |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return mismatch === 0;
}
