/**
 * IndexedDB-backed persistence for conversation snapshots.
 * Hand-rolled — no external dependencies.
 *
 * Snapshots are evicted after MAX_AGE_MS (7 days).
 * Non-serializable fields (pendingFile, localPreviewUrl) are stripped before write.
 */

import type { CachedMessage, ConvSnapshot, PersistedSnapshot } from "./conv-types";

// Re-export so external consumers that imported from this file keep working.
export type { PersistedSnapshot };

const DB_NAME = "sbi-messages";
const STORE_NAME = "conv-snapshots";
const DB_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "convId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Strip non-serializable fields before persisting. */
function sanitizeMessages(messages: CachedMessage[]): CachedMessage[] {
  return messages.map((m) => ({
    ...m,
    attachments: m.attachments.map((a) => ({
      ...a,
      pendingFile: null,
      localPreviewUrl: null,
    })),
  }));
}

export async function loadAllPersisted(): Promise<PersistedSnapshot[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const now = Date.now();
        const all: PersistedSnapshot[] = getAllReq.result ?? [];
        const fresh: PersistedSnapshot[] = [];
        const stale: string[] = [];
        for (const snap of all) {
          if (now - snap.cachedAt > MAX_AGE_MS) {
            stale.push(snap.convId);
          } else {
            fresh.push(snap);
          }
        }
        // Evict stale entries.
        for (const id of stale) {
          store.delete(id);
        }
        resolve(fresh);
      };
      getAllReq.onerror = () => reject(getAllReq.error);
    });
  } catch {
    return [];
  }
}

export async function persistSnapshot(convId: string, snapshot: ConvSnapshot): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const record: PersistedSnapshot = {
      convId,
      messages: sanitizeMessages(snapshot.messages),
      lastRead: snapshot.lastRead,
      cachedAt: snapshot.cachedAt,
      newDividerBeforeId: snapshot.newDividerBeforeId,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB failures are non-fatal.
  }
}

export async function deletePersisted(convId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(convId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal.
  }
}
