import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const BUCKET = "Files";

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
 */
export async function listFolder(
    path: string,
    opts?: { force?: boolean; limit?: number },
): Promise<{ data: StorageEntry[]; error: { message: string } | null }> {
    if (!opts?.force) {
        const cached = getCachedList(path);
        if (cached) {
            return { data: cached, error: null };
        }
    }

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(path, { limit: opts?.limit ?? 200 });

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
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000 });

    if (error) {
        throw new Error(error.message);
    }

    const entries = (data ?? []) as StorageEntry[];
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
            .remove(batch);
        if (error) {
            throw new Error(error.message);
        }
        // Supabase Storage returns 200 with an EMPTY array (no error) when a
        // DELETE is blocked by bucket RLS — a silent failure. Treat "deleted
        // fewer than requested" as a permission error instead of false success.
        if (!data || data.length < batch.length) {
            throw new Error(
                "Delete was blocked — you don't have permission to delete here.",
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
            .move(from, to);

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
                .move(m.to, m.from);
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
        .move(oldPath, newPath);
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
        .upload(targetPath, file, { upsert: false });
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
    return message || "Something went wrong. Please try again.";
}
