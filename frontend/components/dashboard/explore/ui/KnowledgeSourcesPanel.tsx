"use client";

import { ChevronDown, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteKnowledgeSource,
  type KnowledgeSource,
  listKnowledgeSources,
  uploadKnowledgeDocument,
} from "@/lib/api/knowledge";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";

/**
 * Collapsible disclosure of the RAG documents the Explore assistant can pull
 * from for the active project (its `search_documents` corpus). Read-only for
 * clients/members; directors can upload PDFs into the index and remove them.
 * Scoped to the active project; switching projects resets it.
 */
export function KnowledgeSourcesPanel({ className }: { className?: string }) {
  const { user, activeProject } = useProject();
  const projectId = activeProject?.projectId ?? null;
  const isDirector = user?.role === "director";

  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (projectId === null) return;
    setLoading(true);
    try {
      setSources(await listKnowledgeSources(projectId));
      setLoaded(true);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Couldn't load sources");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Reset whenever the active project changes (projectId is the trigger, even
  // though the body only resets state).
  // biome-ignore lint/correctness/useExhaustiveDependencies: project-keyed reset
  useEffect(() => {
    setLoaded(false);
    setSources([]);
  }, [projectId]);

  // Load on first expand (and when the project changes while expanded).
  useEffect(() => {
    if (open && projectId !== null) void refresh();
  }, [open, projectId, refresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || projectId === null) return;
    setUploading(true);
    try {
      await uploadKnowledgeDocument(projectId, file);
      toastSuccess(`Added ${file.name} to the assistant's sources`);
      await refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (filename: string) => {
    if (projectId === null) return;
    try {
      await deleteKnowledgeSource(projectId, filename);
      setSources((prev) => prev.filter((s) => s.filename !== filename));
      toastSuccess(`Removed ${filename}`);
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Couldn't remove document",
      );
    }
  };

  if (projectId === null) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <FileText className="size-3.5 text-sbi-muted-dark" strokeWidth={1.5} />
        <span className="text-xs font-light text-sbi-muted">
          Sources the assistant can use
        </span>
        {loaded && (
          <span className="text-xs font-light tabular-nums text-sbi-muted-dark">
            {sources.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-sbi-muted-dark transition-transform duration-300",
            open && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="border-t border-sbi-dark-border/40 px-2 py-2">
          {loading && !loaded ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-sbi-muted-dark">
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              Loading sources...
            </div>
          ) : sources.length === 0 ? (
            <p className="px-2 py-3 text-xs font-light leading-relaxed text-sbi-muted-dark">
              No documents are indexed for this project yet.
              {isDirector
                ? " Upload a PDF to let the assistant draw on it."
                : ""}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sources.map((s) => (
                <li
                  key={s.filename}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sbi-dark/40"
                >
                  <FileText
                    className="size-3.5 shrink-0 text-sbi-green/70"
                    strokeWidth={1.5}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                    {s.filename}
                  </span>
                  <span className="shrink-0 text-[0.7rem] tabular-nums text-sbi-muted-dark">
                    {s.chunks} chunk{s.chunks === 1 ? "" : "s"}
                  </span>
                  {isDirector && (
                    <button
                      type="button"
                      onClick={() => handleRemove(s.filename)}
                      aria-label={`Remove ${s.filename}`}
                      className="shrink-0 text-sbi-muted-dark opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isDirector && (
            <div className="mt-1 px-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-light text-sbi-muted transition-colors hover:text-sbi-green disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2
                    className="size-3.5 animate-spin"
                    strokeWidth={1.5}
                  />
                ) : (
                  <Plus className="size-3.5" strokeWidth={1.5} />
                )}
                {uploading ? "Uploading..." : "Upload PDF"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
