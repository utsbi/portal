"use client";

import { BookText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useChat } from "@/lib/chat/chat-context";
import { cn } from "@/lib/utils";
import { getFileInfo } from "./file-info";
import { HoverPeekPanel } from "./HoverPeekPanel";

/**
 * Right-edge panel listing the documents the LATEST answer is grounded in. The
 * Explore agent is RAG over the client's project files, so each assistant turn
 * carries the sources it cited. We surface the most recent answer's sources;
 * when the latest answer has none (or it's a fresh greeting), the panel and its
 * tab disappear entirely.
 */
export function SourcesPanel() {
  const { messages } = useChat();
  const [expanded, setExpanded] = useState<number | null>(null);

  // Last assistant message that actually carries sources.
  const sources = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.sources && m.sources.length > 0) {
        return m.sources;
      }
    }
    return [];
  }, [messages]);

  return (
    <HoverPeekPanel
      storageKey="explore-sources-pinned"
      title={`Sources · ${sources.length}`}
      icon={BookText}
      tabLabel="Show sources for the latest answer"
      hidden={sources.length === 0}
    >
      <div className="px-2 pb-3 pt-1 space-y-1">
        {sources.map((source, index) => {
          const fileInfo = getFileInfo(source.filename);
          const isOpen = expanded === index;
          const preview = (source.content || "").slice(0, 320).trim();
          const name = source.filename.replace(/\.[^/.]+$/, "");
          return (
            <div
              key={`${source.filename}:${source.page_number ?? ""}:${index}`}
              className={cn(
                "rounded-lg border transition-colors",
                isOpen
                  ? "border-sbi-green/30 bg-sbi-dark-card/60"
                  : "border-transparent hover:bg-sbi-dark-card/60",
              )}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2.5 px-2 py-2 text-left"
              >
                <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 shrink-0 text-[11px] font-medium text-sbi-green/90 bg-sbi-green/10 border border-sbi-green/30 rounded-md">
                  {index + 1}
                </span>
                {fileInfo.icon}
                <span className="min-w-0 flex flex-col">
                  <span className="text-[13px] text-white/90 truncate">
                    {name}
                    {source.page_number ? (
                      <span className="text-sbi-muted-dark">
                        {" "}
                        · p. {source.page_number}
                      </span>
                    ) : null}
                  </span>
                  <span className={cn("text-[11px]", fileInfo.color)}>
                    {fileInfo.label}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="px-2 pb-2 -mt-0.5 space-y-2">
                  {preview && (
                    <p className="text-[12px] leading-relaxed text-sbi-muted line-clamp-6">
                      {preview}
                    </p>
                  )}
                  <Link
                    href={`/dashboard/files?file=${encodeURIComponent(source.filename)}`}
                    className="inline-flex items-center gap-1.5 text-[12px] text-sbi-green/90 hover:text-sbi-green transition-colors no-underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Open in Files
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HoverPeekPanel>
  );
}
