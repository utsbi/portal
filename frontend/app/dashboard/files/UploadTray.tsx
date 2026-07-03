"use client";

import { AlertCircle, Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type UploadItemStatus = "uploading" | "indexing" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  status: UploadItemStatus;
  /** Humanized failure reason, shown under the filename for `error` rows. */
  error?: string;
}

function isInFlight(item: UploadItem) {
  return item.status === "uploading" || item.status === "indexing";
}

function StatusGlyph({ item }: { item: UploadItem }) {
  if (isInFlight(item)) {
    return (
      <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-sbi-green/40 border-t-sbi-green/90" />
    );
  }
  if (item.status === "error") {
    return (
      <AlertCircle className="size-4 shrink-0 text-red-400" strokeWidth={1.5} />
    );
  }
  return <Check className="size-4 shrink-0 text-sbi-green" strokeWidth={2} />;
}

/**
 * Google-Drive-style upload tray: a fixed bottom-right card listing each
 * file's upload (and knowledge-indexing) progress, so the Upload button never
 * blocks. Collapsible; closable once nothing is in flight.
 */
export function UploadTray({
  items,
  onClose,
}: {
  items: UploadItem[];
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const inFlight = items.filter(isInFlight).length;
  const failed = items.filter((it) => it.status === "error").length;
  const title =
    inFlight > 0
      ? `Uploading ${inFlight} item${inFlight === 1 ? "" : "s"}…`
      : failed > 0
        ? `${items.length - failed} of ${items.length} upload${items.length === 1 ? "" : "s"} complete`
        : `${items.length} upload${items.length === 1 ? "" : "s"} complete`;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-sbi-dark-border bg-sbi-dark-card shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-1 border-b border-sbi-dark-border bg-sbi-dark/60 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/90">
          {title}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
          className="rounded-md p-1 text-sbi-muted transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              collapsed && "rotate-180",
            )}
            strokeWidth={1.5}
          />
        </button>
        {inFlight === 0 && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close uploads"
            className="rounded-md p-1 text-sbi-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!collapsed && (
        <ul className="max-h-56 overflow-y-auto dashboard-scrollbar py-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 px-3 py-1.5">
              <StatusGlyph item={item} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-light text-white/90">
                  {item.name}
                </div>
                {item.status === "indexing" ? (
                  <div className="text-[11px] font-light text-sbi-muted">
                    Adding to project knowledge…
                  </div>
                ) : item.status === "error" && item.error ? (
                  <div className="text-[11px] font-light text-red-400/90">
                    {item.error}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
