"use client";

import { MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  btnPrimary,
  EmptyState,
  inputClass,
} from "@/components/dashboard/common/ui";
import { cn } from "@/lib/utils";

// Minimal conversation shape required by the list UI. The batched
// name-resolution in index.tsx / DirectorMessages.tsx populates this exactly.
export interface Conversation {
  id: string;
  name: string;
  projectName?: string;
  lastMessage: string;
  /** Absolute date + time label (never time-only). */
  timestamp: string;
  /** Quiet emphasis only — no badge/dot/count. */
  unread?: boolean;
  /** Epoch ms of latest activity; used for sorting (not created_at). */
  lastActivity?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  basePath: string;
  /** True while the first load is in flight (skeleton vs empty state). */
  loading?: boolean;
  /** True when the initial load failed; shows a retry affordance. */
  errored?: boolean;
  onRetry?: () => void;
  /** Called after a 200ms hover dwell — warms the conv cache before click. */
  onPrefetch?: (convId: string) => void;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="px-3 py-2.5 rounded-md border border-sbi-dark-border/30"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="h-3.5 w-32 rounded bg-sbi-dark-card/80 animate-pulse" />
            <div className="h-3 w-20 rounded bg-sbi-dark-card/60 animate-pulse" />
          </div>
          <div className="h-3 w-44 rounded bg-sbi-dark-card/50 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  conversations,
  basePath,
  loading = false,
  errored = false,
  onRetry,
  onPrefetch,
}: ConversationListProps) {
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  // Mirror the thread's pattern: only show the skeleton if the load is still
  // going after a short grace window, so a fast fetch never flashes it.
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const t = setTimeout(() => setShowSkeleton(true), 220);
    return () => clearTimeout(t);
  }, [loading]);

  const activeId = useMemo(() => {
    const m = pathname?.match(/\/messages\/(\d+)/);
    return m ? m[1] : null;
  }, [pathname]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.projectName?.toLowerCase().includes(q) ?? false) ||
            c.lastMessage.toLowerCase().includes(q),
        )
      : conversations;

    // Sort by latest message activity, not conversation created_at.
    return [...filtered].sort(
      (a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0),
    );
  }, [conversations, query]);

  return (
    <div className="flex flex-col min-h-0 h-full w-full">
      <div className="px-4 pb-3 shrink-0">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sbi-muted-dark"
            size={15}
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className={cn(inputClass, "pl-9 pr-3")}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
        {loading && showSkeleton ? (
          <ListSkeleton />
        ) : loading ? (
          // Grace window before the skeleton: blank placeholder so a fast
          // load reads as instant instead of a skeleton flash.
          <div className="min-h-full" />
        ) : errored ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-white">Conversations didn't load.</p>
            <p className="mt-1 text-xs text-sbi-muted">
              Check your connection and try again.
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className={cn(btnPrimary, "mt-4 px-4 h-9")}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-6" />}
            title={query.trim() ? "No results" : "No conversations yet"}
            description={
              query.trim() ? "No conversations match that search." : undefined
            }
          />
        ) : (
          visible.map((convo) => {
            const isActive = activeId === convo.id;
            // The open conversation reads as read immediately (optimistic),
            // so the tick clears the moment you open it — not on reload.
            const isUnread = convo.unread && !isActive;
            return (
              <Link
                key={convo.id}
                href={`${basePath}/${convo.id}`}
                className={`group relative flex gap-2 px-3 py-2.5 mb-1 rounded-md border transition-colors ${
                  isActive
                    ? "border-sbi-green/30 bg-sbi-dark-card/60"
                    : "border-sbi-dark-border/30 hover:border-sbi-green/30 hover:bg-sbi-dark-card/40"
                }`}
                onMouseEnter={() => {
                  if (!onPrefetch) return;
                  const id = convo.id;
                  prefetchTimerRef.current = setTimeout(() => {
                    onPrefetch(id);
                  }, 200);
                }}
                onMouseLeave={() => {
                  if (prefetchTimerRef.current !== null) {
                    clearTimeout(prefetchTimerRef.current);
                    prefetchTimerRef.current = null;
                  }
                }}
              >
                {/* Thin accent tick for unread — no dot, count, or badge.
                    w-[3px] (not w-px): a 1px element sub-pixel-rounds to
                    zero on fractional DPR / some browsers (e.g. Brave). */}
                <span
                  aria-hidden
                  className={`w-[3px] shrink-0 self-stretch rounded-full ${
                    isUnread ? "bg-sbi-green/70" : "bg-transparent"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      className={`truncate text-sm ${
                        isUnread
                          ? "text-white font-semibold"
                          : "text-white/90 font-medium"
                      }`}
                    >
                      {convo.name}
                    </span>
                    <span className="text-sbi-muted-dark text-[11px] tabular-nums shrink-0">
                      {convo.timestamp}
                    </span>
                  </div>
                  {convo.projectName ? (
                    <p className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark truncate mb-1">
                      {convo.projectName}
                    </p>
                  ) : null}
                  <p
                    className={`truncate text-xs ${
                      isUnread ? "text-sbi-muted" : "text-sbi-muted-dark"
                    }`}
                  >
                    {convo.lastMessage || "No messages yet"}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
