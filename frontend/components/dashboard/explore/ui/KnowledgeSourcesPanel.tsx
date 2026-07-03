"use client";

import { BookOpenText, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  type KnowledgeSource,
  listKnowledgeSources,
} from "@/lib/api/knowledge";
import { toastError } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";
import { getFileInfo } from "./file-info";

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

  // Load eagerly on mount / project switch so the header count is correct
  // before the first expand (it's one cheap RLS-scoped select).
  useEffect(() => {
    if (projectId !== null) void refresh();
  }, [projectId, refresh]);

  if (projectId === null) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <BookOpenText
          className="size-4 shrink-0 text-sbi-green/70"
          strokeWidth={1.5}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-light text-white/85">
          Assistant knowledge
        </span>
        {loaded && sources.length > 0 && (
          <span className="shrink-0 text-[11px] font-light tabular-nums text-sbi-muted-dark">
            {sources.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-sbi-muted-dark transition-transform duration-300 group-hover:text-sbi-muted",
            open && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="border-t border-sbi-dark-border/40">
          {loading && !loaded ? (
            <div className="space-y-1 px-3.5 py-2.5">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2.5 py-1">
                  <div className="size-4 shrink-0 animate-pulse rounded bg-white/5" />
                  <div
                    className={cn(
                      "h-3 animate-pulse rounded bg-white/5",
                      i === 0 ? "w-3/5" : "w-2/5",
                    )}
                  />
                </div>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <p className="px-3.5 py-3 text-xs font-light leading-relaxed text-sbi-muted-dark">
              Nothing indexed yet. Upload a PDF, Word, text, slides, or
              spreadsheet file and it's added automatically — then ask Explore
              about it.
            </p>
          ) : (
            <ul className="py-1.5">
              {sources.map((s) => {
                const fileInfo = getFileInfo(s.filename);
                return (
                  <li
                    key={s.filename}
                    title={s.filename}
                    className="flex items-center gap-2.5 px-3.5 py-1.5"
                  >
                    <span className="shrink-0 [&_svg]:size-4">
                      {fileInfo.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-light text-white/85">
                      {s.filename}
                    </span>
                    <span className="shrink-0 text-[11px] font-light tabular-nums text-sbi-muted-dark">
                      {s.chunks}
                      <span className="hidden sm:inline">
                        {" "}
                        chunk{s.chunks === 1 ? "" : "s"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
