"use client";

import { ChevronDown, FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  type KnowledgeSource,
  listKnowledgeSources,
} from "@/lib/api/knowledge";
import { toastError } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";

/**
 * Collapsible, read-only disclosure of the RAG documents the Explore assistant
 * can pull from for the active project (its `search_documents` corpus). Lives in
 * the Files page; indexing now happens via the Document-Portal Upload button
 * (auto-index on upload), so this panel no longer uploads or deletes — it just
 * shows what the assistant can read. Scoped to the active project; switching
 * projects resets it.
 */
export function KnowledgeSourcesPanel({ className }: { className?: string }) {
  const { activeProject } = useProject();
  const projectId = activeProject?.projectId ?? null;

  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
          What the assistant can read
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
              No documents are indexed for this project yet. Upload an indexable
              file (PDF, Word, text, slides, or a spreadsheet) and it will be
              added here automatically.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sources.map((s) => (
                <li
                  key={s.filename}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5"
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
