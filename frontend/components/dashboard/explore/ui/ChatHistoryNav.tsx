"use client";

import {
  MessageSquarePlus,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SessionSummary, useChat } from "@/lib/chat/chat-context";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";

// Date buckets, in display order. Sessions arrive already sorted by updated_at desc.
const BUCKET_ORDER = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Older",
] as const;
type Bucket = (typeof BUCKET_ORDER)[number];

function startOfDay(ms: number): number {
  const x = new Date(ms);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function bucketFor(iso: string | null): Bucket {
  if (!iso) return "Older";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Older";
  const diffDays = Math.round(
    (startOfDay(Date.now()) - startOfDay(t)) / 86_400_000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  return "Older";
}

// Placeholder groups/rows shown while the session list is first fetched. Varied
// widths so it reads as a real list of titles rather than a uniform block.
const SKELETON_GROUPS: { id: string; rows: string[] }[] = [
  { id: "today", rows: ["w-4/5", "w-3/5", "w-3/4", "w-1/2"] },
  { id: "previous", rows: ["w-2/3", "w-4/5", "w-1/2"] },
];

function ChatHistorySkeleton() {
  return (
    <div aria-hidden="true">
      {SKELETON_GROUPS.map((group) => (
        <div key={group.id}>
          <div className="px-3 pt-3 pb-1">
            <div className="h-2.5 w-14 animate-pulse rounded-sm bg-sbi-dark-border/40" />
          </div>
          {group.rows.map((w) => (
            <div key={`${group.id}-${w}`} className="px-3 py-2">
              <div
                className={cn(
                  "h-3.5 animate-pulse rounded bg-sbi-dark-border/30",
                  w,
                )}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Contextual chat-history list rendered inside the global left sidebar while on
 * the Explore route. Navigation stays in-surface: ExplorePortal is mounted and
 * shares this ChatProvider, so we mutate chat state + the URL directly
 * (loadSession + history.replaceState) instead of doing a Next navigation, which
 * would remount Explore and wipe an in-flight stream.
 */
interface ChatHistoryNavProps {
  /** When the collapsed rail's search icon expanded the sidebar, this ref is
   *  true; we focus the search box on mount and reset it. */
  focusSearchRef?: { current: boolean };
}

export function ChatHistoryNav({ focusSearchRef }: ChatHistoryNavProps = {}) {
  const {
    sessionList,
    sessionsLoaded,
    refreshSessions,
    loadSession,
    newSession,
    renameSession,
    setPinned,
    deleteSession,
    sessionId,
  } = useChat();
  const { activeProject } = useProject();
  const activeProjectId = activeProject?.projectId ?? null;

  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  // The list is a shared, cached state on the provider, so it survives collapse/
  // expand without refetching. Only fetch once, the first time it's needed; the
  // provider keeps it fresh afterwards (mutations + new-chat/title changes).
  useEffect(() => {
    if (!sessionsLoaded) void refreshSessions();
  }, [sessionsLoaded, refreshSessions]);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  // If expansion was triggered by the collapsed rail's search icon, focus the
  // search box now that we've mounted, then clear the one-shot flag.
  useEffect(() => {
    if (focusSearchRef?.current) {
      focusSearchRef.current = false;
      searchInputRef.current?.focus();
    }
  }, [focusSearchRef]);

  const handleSelect = (publicId: string) => {
    void loadSession(publicId);
    window.history.replaceState(null, "", `/dashboard/explore/${publicId}`);
  };

  const handleNewChat = () => {
    newSession();
    window.history.replaceState(null, "", "/dashboard/explore/new");
  };

  const beginRename = (s: SessionSummary) => {
    setEditingId(s.id);
    setEditValue(s.title || "");
  };

  const commitRename = async () => {
    const id = editingId;
    if (id === null) return;
    const next = editValue.trim();
    setEditingId(null);
    const current = sessionList.find((s) => s.id === id);
    if (!next || next === (current?.title || "")) return;
    await renameSession(id, next);
  };

  const handleTogglePin = async (s: SessionSummary) => {
    await setPinned(s.id, !s.pinned);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    await deleteSession(target.id);
    setDeleteTarget(null);
    if (sessionId === target.id) {
      newSession();
      window.history.replaceState(null, "", "/dashboard/explore/new");
    }
  };

  const { pinnedSessions, grouped, projectCount } = useMemo(() => {
    // Project-locked sidebar: show the active project's chats, plus untagged
    // (legacy / project-less) chats so nothing silently disappears. Other
    // projects' chats are hidden here — the dedicated /dashboard/chats page
    // remains the unfiltered "all chats" view.
    const base = sessionList.filter(
      (s) => s.project_id === activeProjectId || s.project_id == null,
    );
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter((s) => (s.title || "Untitled").toLowerCase().includes(q))
      : base;
    const pinnedList = filtered.filter((s) => s.pinned);
    const rest = filtered.filter((s) => !s.pinned);
    const map = new Map<Bucket, SessionSummary[]>();
    for (const s of rest) {
      const b = bucketFor(s.updated_at);
      const arr = map.get(b);
      if (arr) arr.push(s);
      else map.set(b, [s]);
    }
    const groups = BUCKET_ORDER.map(
      (b) => [b, map.get(b) ?? []] as const,
    ).filter(([, arr]) => arr.length > 0);
    return {
      pinnedSessions: pinnedList,
      grouped: groups,
      projectCount: base.length,
    };
  }, [sessionList, query, activeProjectId]);

  const loading = !sessionsLoaded;
  const hasAny = projectCount > 0;
  const noMatches =
    hasAny && pinnedSessions.length === 0 && grouped.length === 0;

  const renderRow = (s: SessionSummary) => {
    const isActive = sessionId === s.id;
    const isEditing = editingId === s.id;
    return (
      <div
        key={s.id}
        className={cn(
          "group/item relative flex items-center rounded-md transition-colors",
          isActive ? "bg-sbi-green/10" : "hover:bg-sbi-dark-card/60",
        )}
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditingId(null);
              }
            }}
            className="flex-1 mx-1 my-1 px-2 h-7 rounded bg-sbi-dark border border-sbi-green/40 text-[13px] text-white focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => handleSelect(s.public_id)}
            className={cn(
              "min-w-0 flex-1 flex items-center gap-1.5 text-left px-3 py-2 text-sm font-light truncate",
              isActive
                ? "text-white"
                : "text-sbi-muted group-hover/item:text-white",
            )}
            title={s.title || "Untitled"}
          >
            {s.pinned && (
              <Pin
                className="h-3 w-3 shrink-0 text-sbi-muted-dark"
                strokeWidth={1.5}
              />
            )}
            <span className="truncate">{s.title || "Untitled"}</span>
          </button>
        )}

        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Conversation options"
                onClick={(e) => e.stopPropagation()}
                className="mr-1 h-6 w-6 shrink-0 inline-flex items-center justify-center rounded text-sbi-muted-dark opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 hover:text-white hover:bg-sbi-dark-card transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-sbi-dark border-sbi-dark-border text-sbi-muted min-w-[8rem]"
            >
              <DropdownMenuItem
                onClick={() => handleTogglePin(s)}
                className="text-xs gap-2 focus:bg-sbi-dark-card/60 focus:text-white cursor-pointer"
              >
                {s.pinned ? (
                  <PinOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                ) : (
                  <Pin className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {s.pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => beginRename(s)}
                className="text-xs gap-2 focus:bg-sbi-dark-card/60 focus:text-white cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-sbi-dark-border" />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(s)}
                className="text-xs gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed header: title, search, new chat */}
      <div className="shrink-0 px-2 pt-3 pb-2 space-y-1">
        <div className="px-3">
          <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted font-light">
            Chats
          </span>
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sbi-muted"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search conversations"
            className="w-full h-8 pl-9 pr-3 rounded-md bg-sbi-dark-card/60 border border-sbi-dark-border/50 text-[13px] text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/50 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sbi-muted hover:text-white transition-colors duration-300"
        >
          <MessageSquarePlus
            className="size-[18px] group-hover:text-sbi-green transition-colors duration-300"
            strokeWidth={1.5}
          />
          <span className="text-sm font-light tracking-wide">New chat</span>
          <span className="absolute inset-0 -z-10 rounded-lg bg-sbi-green/0 group-hover:bg-sbi-green/5 transition-colors duration-300" />
        </button>
        <Link
          href="/dashboard/chats"
          className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sbi-muted hover:text-white transition-colors duration-300"
        >
          <MessagesSquare
            className="size-[18px] group-hover:text-sbi-green transition-colors duration-300"
            strokeWidth={1.5}
          />
          <span className="text-sm font-light tracking-wide">All chats</span>
          <span className="absolute inset-0 -z-10 rounded-lg bg-sbi-green/0 group-hover:bg-sbi-green/5 transition-colors duration-300" />
        </Link>
      </div>

      {/* Scrollable conversation list */}
      <div className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar px-2 pb-2">
        {loading && <ChatHistorySkeleton />}
        {!loading && !hasAny && (
          <div className="px-3 py-6 text-xs text-sbi-muted-dark">
            No conversations yet.
          </div>
        )}
        {!loading && noMatches && (
          <div className="px-3 py-6 text-xs text-sbi-muted-dark">
            No conversations match “{query.trim()}”.
          </div>
        )}

        {!loading && pinnedSessions.length > 0 && (
          <div>
            <div className="px-3 pt-3 pb-1 text-[11px] font-medium text-sbi-muted-dark">
              Pinned
            </div>
            {pinnedSessions.map(renderRow)}
          </div>
        )}

        {!loading &&
          grouped.map(([bucket, items]) => (
            <div key={bucket}>
              <div className="px-3 pt-3 pb-1 text-[11px] font-medium text-sbi-muted-dark">
                {bucket}
              </div>
              {items.map(renderRow)}
            </div>
          ))}
      </div>

      <ConfirmDialog
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete conversation"
        description={
          <>
            This permanently deletes{" "}
            <span className="text-white font-medium">
              {deleteTarget?.title || "this conversation"}
            </span>{" "}
            and all of its messages. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
      />
    </div>
  );
}
