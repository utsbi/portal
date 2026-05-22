/**
 * Signed-URL TTL cache with batched signing.
 * Key: `${path}|w${width ?? "full"}q${quality ?? "full"}`.
 * Safety window: reuse only if URL expires >= 5 min from now.
 *
 * Two signing modes:
 * - No transforms requested → batched `createSignedUrls` (one round-trip).
 * - Transforms requested → `createSignedUrl` (singular) per path in parallel,
 *   since only the singular endpoint accepts `transform: { width, quality }`.
 *   N parallel HTTP/2 requests is still much faster end-to-end than serving
 *   full-res images (a 280×280 webp thumb is ~10–50KB vs 2–8MB originals).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface CacheEntry {
  url: string;
  expiresAt: number; // epoch ms
}

const urlCache = new Map<string, CacheEntry>();

const SAFETY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface SignOpts {
  width?: number;
  quality?: number;
  expiresIn?: number;
}

function buildKey(path: string, opts?: SignOpts): string {
  const w = opts?.width ?? "full";
  const q = opts?.quality ?? "full";
  return `${path}|w${w}q${q}`;
}

/**
 * Returns a path→signedUrl map for the given paths.
 * Cached entries that are still fresh (>= 5 min remaining) are reused.
 * Stale/missing paths are signed — batched when no transforms are needed,
 * otherwise via N parallel singular calls so transforms can apply.
 */
export async function signWithCache(
  supabase: SupabaseClient,
  paths: string[],
  opts?: SignOpts,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const now = Date.now();
  const expiresIn = opts?.expiresIn ?? 3600;
  const stale: string[] = [];

  for (const path of paths) {
    const key = buildKey(path, opts);
    const entry = urlCache.get(key);
    if (entry && entry.expiresAt > now + SAFETY_WINDOW_MS) {
      result.set(path, entry.url);
    } else {
      stale.push(path);
    }
  }

  if (stale.length === 0) return result;

  const wantsTransform =
    opts?.width !== undefined || opts?.quality !== undefined;

  if (wantsTransform) {
    // Parallel singular calls so `transform` is honored.
    const transform = { width: opts?.width, quality: opts?.quality };
    const signed = await Promise.all(
      stale.map(async (path) => {
        const { data } = await supabase.storage
          .from("Message Attachments")
          .createSignedUrl(path, expiresIn, { transform });
        return { path, signedUrl: data?.signedUrl ?? null };
      }),
    );
    for (const s of signed) {
      if (!s.signedUrl) continue;
      const key = buildKey(s.path, opts);
      urlCache.set(key, {
        url: s.signedUrl,
        expiresAt: now + expiresIn * 1000,
      });
      result.set(s.path, s.signedUrl);
    }
    return result;
  }

  // Full-res, batched.
  const { data: signed } = await supabase.storage
    .from("Message Attachments")
    .createSignedUrls(stale, expiresIn);

  if (signed) {
    for (const s of signed) {
      if (!s.signedUrl || s.path == null) continue;
      const key = buildKey(s.path, opts);
      urlCache.set(key, {
        url: s.signedUrl,
        expiresAt: now + expiresIn * 1000,
      });
      result.set(s.path, s.signedUrl);
    }
  }

  return result;
}
