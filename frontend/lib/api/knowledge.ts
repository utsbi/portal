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
 * enforced by RLS). */
export async function deleteKnowledgeSource(
  projectId: number,
  filename: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("client_knowledge")
    .delete()
    .eq("project_id", projectId)
    .eq("metadata->>filename", filename);
  if (error) throw new Error(error.message);
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
