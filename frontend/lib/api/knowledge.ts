import { createClient } from "@/lib/supabase/client";

/**
 * The RAG "knowledge" corpus the Explore assistant searches via its
 * `search_documents` tool lives in the `client_knowledge` table (embedded
 * chunks), scoped per project. This module surfaces it to the UI: list what a
 * project has indexed, upload a new PDF into it, and remove a document.
 *
 * Reads/deletes go straight through the RLS-scoped Supabase client (project
 * members can read; project directors can delete). Uploads go through
 * /api/knowledge/upload, which forwards to the backend ingester (embeddings +
 * membership re-check).
 */

export interface KnowledgeSource {
  /** Original document filename (from chunk metadata). */
  filename: string;
  /** Number of embedded chunks stored for this document. */
  chunks: number;
  /** Most recent upload timestamp across this document's chunks. */
  uploadedAt: string | null;
}

interface ChunkRow {
  metadata: { filename?: string; upload_date?: string } | null;
  created_at: string | null;
}

/** List the project's indexed documents, grouped by filename. */
export async function listKnowledgeSources(
  projectId: number,
): Promise<KnowledgeSource[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("client_knowledge")
    .select("metadata, created_at")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);

  const byFile = new Map<
    string,
    { chunks: number; uploadedAt: string | null }
  >();
  for (const row of (data ?? []) as ChunkRow[]) {
    const filename = row.metadata?.filename ?? "Untitled document";
    const entry = byFile.get(filename) ?? { chunks: 0, uploadedAt: null };
    entry.chunks += 1;
    const when = row.metadata?.upload_date ?? row.created_at;
    if (when && (!entry.uploadedAt || when > entry.uploadedAt)) {
      entry.uploadedAt = when;
    }
    byFile.set(filename, entry);
  }

  return Array.from(byFile.entries())
    .map(([filename, v]) => ({
      filename,
      chunks: v.chunks,
      uploadedAt: v.uploadedAt,
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

/** Remove every chunk of a document from the project's index (directors only,
 * enforced by RLS).
 *
 * Documents carry no per-chunk document id, so chunks are grouped/deleted by
 * `metadata->>filename` (matching `listKnowledgeSources`). `.select("id")`
 * returns the deleted rows so we can fail loudly when nothing matched — an RLS
 * block, an already-removed document, or a NULL-metadata row — instead of
 * reporting a phantom success the optimistic UI would trust. */
export async function deleteKnowledgeSource(
  projectId: number,
  filename: string,
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("client_knowledge")
    .delete()
    .eq("project_id", projectId)
    .eq("metadata->>filename", filename)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      `Couldn't remove "${filename}" — it may have already been deleted or you may not have permission.`,
    );
  }
}

/** Upload a PDF into the project's index via the backend ingester. */
export async function uploadKnowledgeDocument(
  projectId: number,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("project_id", String(projectId));

  const res = await fetch("/api/knowledge/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: `Upload failed (${res.status})` }));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
}

/** One Document-Portal file indexed into the project's RAG corpus. */
export interface IndexedFile {
  /** Project-relative Storage path (e.g. "Media/contract.pdf"). */
  storage_path: string;
  /** Number of embedded chunks stored for this file. */
  chunks: number;
}

/**
 * Index a Document-Portal file into the project's RAG corpus. `storagePath` is
 * project-relative (e.g. "Media/contract.pdf"); the backend prefixes it with
 * `{project_id}/`. Returns `{ indexed: false, reason }` when the backend skips
 * the file (e.g. unsupported content) rather than throwing.
 */
export async function indexPortalFile(
  projectId: number,
  storagePath: string,
): Promise<{ indexed: boolean; chunks?: number; reason?: string }> {
  const res = await fetch("/api/knowledge/index-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, storage_path: storagePath }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: `Indexing failed (${res.status})` }));
    throw new Error(err.detail || `Indexing failed (${res.status})`);
  }
  return res.json();
}

/**
 * Remove every indexed chunk of a Document-Portal file from the project's RAG
 * corpus. `storagePath` is project-relative.
 */
export async function deletePortalFileIndex(
  projectId: number,
  storagePath: string,
): Promise<{ deleted: number }> {
  const res = await fetch("/api/knowledge/by-file", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, storage_path: storagePath }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: `Remove failed (${res.status})` }));
    throw new Error(err.detail || `Remove failed (${res.status})`);
  }
  return res.json();
}

/**
 * Retarget a Document-Portal file's indexed chunks after a move/rename. Both
 * paths are project-relative. A pure metadata update (no re-embedding) that
 * keeps the "Indexed" badge and citation links pointing at the new location.
 */
export async function movePortalFileIndex(
  projectId: number,
  fromPath: string,
  toPath: string,
): Promise<{ moved: number }> {
  const res = await fetch("/api/knowledge/move-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      from_path: fromPath,
      to_path: toPath,
    }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: `Index move failed (${res.status})` }));
    throw new Error(err.detail || `Index move failed (${res.status})`);
  }
  return res.json();
}

/** List the project's indexed Document-Portal files (project-relative paths). */
export async function listIndexedFiles(
  projectId: number,
): Promise<IndexedFile[]> {
  const res = await fetch(
    `/api/knowledge/indexed?project_id=${encodeURIComponent(projectId)}`,
  );
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: `Couldn't load indexed files (${res.status})` }));
    throw new Error(
      err.detail || `Couldn't load indexed files (${res.status})`,
    );
  }
  return res.json();
}
