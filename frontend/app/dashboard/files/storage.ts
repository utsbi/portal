import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const BUCKET = "Files";

// ---------------------------------------------------------------------------
// Project scope. Every Storage path is transparently prefixed with
// `${activeRoot}/`, so each project only ever reads/writes under its own
// `{projectId}/` subtree. The page works entirely in PROJECT-RELATIVE paths
// ("" = the project root); this module is the single place that knows the
// prefix. The RLS policy on storage.objects enforces the same boundary in the
// database, so this is convenience + correctness, not the security boundary.
// ---------------------------------------------------------------------------

let activeRoot: string | null = null;

/**
 * Point the Files module at a project's subtree. Pass the project id (as a
 * string) to scope all subsequent operations under `${projectId}/`, or `null`
 * for the unscoped bucket root. Changing the root clears the listing cache so
 * project-relative keys can never collide across projects.
 */
export function setStorageRoot(root: string | null) {
  if (root === activeRoot) return;
  activeRoot = root;
  listCache.clear();
}

/** Map a project-relative path to its absolute Storage path. */
export function withRoot(path: string): string {
  if (!activeRoot) return path;
  return path ? `${activeRoot}/${path}` : activeRoot;
}

export interface StorageEntry {
  id: string | null;
  name: string;
  updated_at?: string;
}

// Supabase Storage has no true empty folders: creating one inserts a zero-byte
// sentinel object so the prefix exists. These must never render as files.
export const SENTINEL_FILES = new Set([".emptyFolderPlaceholder", ".keep"]);

export function isFolder(entry: StorageEntry) {
  return entry.id === null;
}

export function isSentinel(entry: StorageEntry) {
  return SENTINEL_FILES.has(entry.name);
}

// ---------------------------------------------------------------------------
// In-memory listing cache (keyed by folder path).
// ---------------------------------------------------------------------------

const listCache = new Map<string, StorageEntry[]>();

export function getCachedList(path: string): StorageEntry[] | undefined {
  return listCache.get(path);
}

export function setCachedList(path: string, entries: StorageEntry[]) {
  listCache.set(path, entries);
}

/** Invalidate a single path's cached listing. */
export function invalidatePath(path: string) {
  listCache.delete(path);
}

/**
 * Invalidate a prefix and everything beneath it (used after recursive
 * folder delete/rename so stale subtree listings can't resurface).
 */
export function invalidatePrefix(prefix: string) {
  if (!prefix) {
    listCache.clear();
    return;
  }
  listCache.delete(prefix);
  for (const key of Array.from(listCache.keys())) {
    if (key === prefix || key.startsWith(`${prefix}/`)) {
      listCache.delete(key);
    }
  }
}

/** Parent prefix of a path ("" for a top-level folder). */
export function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/**
 * True if dropping `srcPath` into `destFolderPath` is not a real move:
 * onto itself, into one of its own descendants, or into the parent it
 * already lives in. Mirrors the hard guards in `useDragMove.handleDragEnd`
 * so drop targets only highlight when the drop would actually do something
 * (collision is intentionally NOT pre-checked here — it's async and, like
 * Google Drive, surfaces on drop).
 */
export function isInvalidMoveTarget(
  srcPath: string,
  srcKind: "file" | "folder",
  destFolderPath: string,
): boolean {
  if (srcPath === destFolderPath) return true;
  if (srcKind === "folder" && destFolderPath.startsWith(`${srcPath}/`)) {
    return true;
  }
  return parentOf(srcPath) === destFolderPath;
}

// ---------------------------------------------------------------------------
// Listing (cache-aware)
// ---------------------------------------------------------------------------

/**
 * List a folder, returning cached entries when available. Pass
 * `force` to bypass the cache (used right after a write op).
 *
 * `stale` is true when the active project root changed (`setStorageRoot`)
 * while this request was in flight: the result belongs to the OLD project, so
 * it is neither cached nor trustworthy for the new one. Callers should treat a
 * stale result as "discard" and not apply it to the current project's UI.
 */
export async function listFolder(
  path: string,
  opts?: { force?: boolean; limit?: number },
): Promise<{
  data: StorageEntry[];
  error: { message: string } | null;
  stale?: boolean;
}> {
  if (!opts?.force) {
    const cached = getCachedList(path);
    if (cached) {
      return { data: cached, error: null };
    }
  }

  // Snapshot the root we're listing under; if it changes mid-flight the
  // result is for a different project and must not poison this one's cache.
  const rootAtRequest = activeRoot;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(withRoot(path), { limit: opts?.limit ?? 200 });

  if (activeRoot !== rootAtRequest) {
    return { data: [], error: null, stale: true };
  }

  if (error) {
    return { data: [], error };
  }

  const entries = (data ?? []) as StorageEntry[];
  setCachedList(path, entries);
  return { data: entries, error: null };
}

// ---------------------------------------------------------------------------
// Recursive collect — every object path under a prefix.
// ---------------------------------------------------------------------------

/**
 * Walk a prefix recursively and collect every object path beneath it,
 * including `.emptyFolderPlaceholder` sentinels. Subfolders are entries
 * whose `id === null`.
 */
export async function collectAllObjectPaths(prefix: string): Promise<string[]> {
  // Paginate: Supabase storage list() caps at `limit` per call, so a folder
  // with more than one page of entries would otherwise be silently truncated —
  // making deleteFolder/moveFolder split large folders. Loop on offset until a
  // short page signals the end.
  const PAGE = 1000;
  const entries: StorageEntry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(withRoot(prefix), { limit: PAGE, offset });

    if (error) {
      throw new Error(error.message);
    }

    const page = (data ?? []) as StorageEntry[];
    entries.push(...page);
    if (page.length < PAGE) break;
  }

  const paths: string[] = [];

  for (const entry of entries) {
    const childPath = `${prefix}/${entry.name}`;
    if (isFolder(entry)) {
      const nested = await collectAllObjectPaths(childPath);
      paths.push(...nested);
    } else {
      paths.push(childPath);
    }
  }

  return paths;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Remove a list of object paths in batches of <= 100. */
export async function removePaths(paths: string[]): Promise<void> {
  for (const batch of chunk(paths, 100)) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .remove(batch.map(withRoot));
    if (error) {
      throw new Error(error.message);
    }
    // Supabase Storage returns 200 with an EMPTY array (no error) when a
    // DELETE is blocked by bucket RLS — a silent failure. Treat "deleted
    // fewer than requested" as a permission error instead of false success.
    if (!data || data.length < batch.length) {
      throw new Error(
        "Delete was blocked. You don't have permission to delete here.",
      );
    }
  }
}

/**
 * Recursively delete everything under a folder prefix (including the
 * sentinel that makes the prefix exist).
 */
export async function deleteFolder(prefix: string): Promise<void> {
  const allPaths = await collectAllObjectPaths(prefix);
  if (allPaths.length === 0) return;
  await removePaths(allPaths);
}

/**
 * Move/rename a folder by moving every object from oldPrefix/... to
 * newPrefix/... (Storage has no native, atomic folder move). Sequential
 * on purpose: on the first failed object move, every already-moved
 * object is moved back, so a mid-move failure leaves the folder wholly
 * at the source rather than silently split across both prefixes. If the
 * compensating rollback itself fails, the thrown error names both
 * locations so the caller can tell the user the data is split.
 */
export async function moveFolder(
  oldPrefix: string,
  newPrefix: string,
): Promise<void> {
  const allPaths = await collectAllObjectPaths(oldPrefix);
  const moved: { from: string; to: string }[] = [];

  for (const from of allPaths) {
    const to = `${newPrefix}${from.slice(oldPrefix.length)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .move(withRoot(from), withRoot(to));

    if (!error) {
      moved.push({ from, to });
      continue;
    }

    // Partial failure: best-effort compensating rollback (newest
    // first) so the folder ends up wholly at the source.
    let rollbackOk = true;
    for (const m of moved.reverse()) {
      const { error: rbErr } = await supabase.storage
        .from(BUCKET)
        .move(withRoot(m.to), withRoot(m.from));
      if (rbErr) rollbackOk = false;
    }

    if (!rollbackOk) {
      throw new Error(
        `Move failed and the folder is now split between "${oldPrefix}" and "${newPrefix}". ${error.message}`,
      );
    }
    throw new Error(error.message);
  }
}

export async function moveObject(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .move(withRoot(oldPath), withRoot(newPath));
  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadFile(
  targetPath: string,
  file: File | Blob,
): Promise<{ error: { message: string; statusCode?: string } | null }> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(withRoot(targetPath), file, { upsert: false });
  return { error: error as { message: string; statusCode?: string } | null };
}

/** Human-readable message for common storage failures. */
export function humanizeStorageError(
  message: string | undefined,
  context: "upload" | "delete" | "rename" | "create",
): string {
  const msg = (message ?? "").toLowerCase();
  if (
    msg.includes("already exists") ||
    msg.includes("duplicate") ||
    msg.includes("409")
  ) {
    return "An item with that name already exists here.";
  }
  if (
    msg.includes("permission") ||
    msg.includes("unauthorized") ||
    msg.includes("403") ||
    msg.includes("row-level security") ||
    msg.includes("violates")
  ) {
    const verb =
      context === "upload"
        ? "upload here"
        : context === "delete"
          ? "delete this"
          : context === "rename"
            ? "rename this"
            : "create folders here";
    return `You don't have permission to ${verb}.`;
  }
  if (msg.includes("invalid key") || msg.includes("invalid object key")) {
    return "This folder path contains unsupported characters. Rename the folder or choose a different location, then try again.";
  }
  return message || "Something went wrong. Please try again.";
}
