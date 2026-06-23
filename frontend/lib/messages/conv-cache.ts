/**
 * In-memory conversation snapshot cache — stale-while-revalidate.
 * Keyed by conversationId (string). No size limit: chat rosters are bounded.
 *
 * On module load, the in-memory Map is hydrated from IndexedDB so that
 * after a page reload, cached conversations are available synchronously
 * (once hydration completes). Hydration is fire-and-forget; the first
 * conv switch in a fresh tab may be a few ms slow if hydration hasn't
 * finished, but all subsequent switches are instant.
 *
 * setCachedConv() also persists to IndexedDB (debounced 500ms per convId).
 */

import { loadAllPersisted, persistSnapshot } from "./conv-storage";
import type {
  CachedAttachment,
  CachedMessage,
  ConvSnapshot,
  PersistedSnapshot,
} from "./conv-types";

// Re-export so existing consumers (MessageThread, prefetch) don't have to
// retarget their imports.
export type { CachedAttachment, CachedMessage, ConvSnapshot };

const cache = new Map<string, ConvSnapshot>();

// Per-convId debounce timers for IndexedDB writes.
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Global hydration promise — resolves after IndexedDB is loaded into cache.
export let hydrationPromise: Promise<void>;

function populate(snapshots: PersistedSnapshot[]): void {
  for (const snap of snapshots) {
    // Only populate if not already in memory (e.g. from a fresh load in this session).
    if (!cache.has(snap.convId)) {
      cache.set(snap.convId, {
        messages: snap.messages as CachedMessage[],
        lastRead: snap.lastRead,
        cachedAt: snap.cachedAt,
        newDividerBeforeId: snap.newDividerBeforeId,
      });
    }
  }
}

// Fire hydration immediately at module load. SSR-safe: indexedDB check is inside loadAllPersisted.
if (typeof window !== "undefined") {
  hydrationPromise = loadAllPersisted()
    .then(populate)
    .catch(() => {});
} else {
  hydrationPromise = Promise.resolve();
}

export function getCachedConv(convId: string): ConvSnapshot | undefined {
  return cache.get(convId);
}

export function setCachedConv(convId: string, snapshot: ConvSnapshot): void {
  cache.set(convId, snapshot);

  // Debounced IndexedDB write — coalesce rapid sets per convId.
  const existing = persistTimers.get(convId);
  if (existing) clearTimeout(existing);
  persistTimers.set(
    convId,
    setTimeout(() => {
      persistTimers.delete(convId);
      persistSnapshot(convId, snapshot).catch(() => {});
    }, 500),
  );
}

/** Updates messages array and bumps cachedAt; preserves other snapshot fields. */
export function patchCachedMessages(
  convId: string,
  next: CachedMessage[],
): void {
  const existing = cache.get(convId);
  if (!existing) return;
  const updated: ConvSnapshot = {
    ...existing,
    messages: next,
    cachedAt: Date.now(),
  };
  cache.set(convId, updated);

  // Debounced persist.
  const t = persistTimers.get(convId);
  if (t) clearTimeout(t);
  persistTimers.set(
    convId,
    setTimeout(() => {
      persistTimers.delete(convId);
      persistSnapshot(convId, updated).catch(() => {});
    }, 500),
  );
}

export function clearCachedConv(convId: string): void {
  cache.delete(convId);
}

/** Resolves when IDB hydration is complete. Safe to call multiple times. */
export function ensureHydrated(): Promise<void> {
  return hydrationPromise;
}
