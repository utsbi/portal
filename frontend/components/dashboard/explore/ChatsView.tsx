"use client";

import {
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  btnPrimary,
  DashboardShell,
  EmptyState,
  inputClass,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SessionSummary, useChat } from "@/lib/chat/chat-context";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";

// ── Date bucketing (shared logic with ChatHistoryNav) ───────────────────

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

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = (Date.now() - then) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172_800) return "yesterday";
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Filter types ────────────────────────────────────────────────────────

type FilterKey = "all" | "pinned" | `project-${number}`;

// ── Skeleton ────────────────────────────────────────────────────────────

const SKELETON_GROUPS: { id: string; count: number }[] = [
  { id: "a", count: 3 },
  { id: "b", count: 4 },
  { id: "c", count: 2 },
];

function ChatsViewSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {SKELETON_GROUPS.map((group) => (
        <div key={group.id} className="mb-5">
          <div className="mb-2 h-2.5 w-20 rounded-sm bg-white/5" />
          <div className="divide-y divide-sbi-dark-border/40">
            {Array.from({ length: group.count }, (_, i) => (
              <div
                key={`${group.id}-${i}`}
                className="flex items-center gap-3 py-3.5"
              >
                <div className="h-4 flex-1 rounded bg-white/5" />
                <div className="h-3 w-16 shrink-0 rounded bg-white/5" />
                <div className="h-3 w-10 shrink-0 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function ChatsView() {
  const router = useRouter();
  const {
    sessionList,
    sessionsLoaded,
    refreshSessions,
    renameSession,
    setPinned,
    deleteSession,
  } = useChat();
  const { projects } = useProject();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  useEffect(() => {
    if (!sessionsLoaded) void refreshSessions();
  }, [sessionsLoaded, refreshSessions]);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  const loading = !sessionsLoaded;

  // Build a project_id → companyName lookup from the project context.
  const projectMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of projects) map.set(p.projectId, p.companyName);
    return map;
  }, [projects]);

  // Derive which project filters to show (only projects that have chats).
  const projectFilters = useMemo(() => {
    const ids = new Set<number>();
    for (const s of sessionList) {
      if (s.project_id != null) ids.add(s.project_id);
    }
    return projects.filter((p) => ids.has(p.projectId));
  }, [sessionList, projects]);

  // Filter → search → bucket
  const { grouped, pinnedInFilter, totalFiltered } = useMemo(() => {
    // 1. Apply filter chip
    let base = sessionList;
    if (filter === "pinned") {
      base = sessionList.filter((s) => s.pinned);
    } else if (filter.startsWith("project-")) {
      const pid = Number(filter.slice(8));
      base = sessionList.filter((s) => s.project_id === pid);
    }

    // 2. Apply search
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter((s) => (s.title || "Untitled").toLowerCase().includes(q))
      : base;

    // 3. Separate pinned from the rest, then bucket the rest
    const pinned = filtered.filter((s) => s.pinned);
    const rest = filtered.filter((s) => !s.pinned);
    const map = new Map<Bucket, SessionSummary[]>();
    for (const s of rest) {
      const b = bucketFor(s.updated_at);
      const arr = map.get(b);
      if (arr) arr.push(s);
      else map.set(b, [s]);
    }
    const buckets = BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
      label: b,
      sessions: map.get(b)!,
    }));

    return {
      grouped: buckets,
      pinnedInFilter: pinned,
      totalFiltered: filtered.length,
    };
  }, [sessionList, filter, query]);

  const openChat = (publicId: string) => {
    router.push(`/dashboard/explore/${publicId}`);
  };

  const handleNewChat = () => {
    router.push("/dashboard/explore/new");
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
    try {
      await renameSession(id, next);
    } catch {
      toastError("Failed to rename chat");
    }
  };

  const handleTogglePin = async (s: SessionSummary) => {
    try {
      await setPinned(s.id, !s.pinned);
    } catch {
      toastError(`Failed to ${s.pinned ? "unpin" : "pin"} chat`);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await deleteSession(target.id);
      toastSuccess("Chat deleted");
    } catch {
      toastError("Failed to delete chat");
    }
    setDeleteTarget(null);
  };

  // ── Row renderer ──────────────────────────────────────────────────────

  const renderRow = (s: SessionSummary) => {
    const isEditing = editingId === s.id;
    const projectName =
      s.project_id != null ? projectMap.get(s.project_id) : null;

    return (
      <motion.div
        key={s.id}
        layout
        initial={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="group flex items-center gap-3 px-2 -mx-2 rounded-lg hover:bg-sbi-dark-card/60 transition-colors"
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
            className="flex-1 my-2 px-2 h-8 rounded bg-sbi-dark border border-sbi-green/40 text-sm text-white focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => openChat(s.public_id)}
            className="min-w-0 flex-1 text-left py-3.5"
          >
            <span className="flex items-center gap-1.5 text-sm text-white/90 group-hover:text-white">
              {s.pinned && (
                <Pin
                  className="h-3.5 w-3.5 shrink-0 text-sbi-muted-dark"
                  strokeWidth={1.5}
                />
              )}
              <span className="truncate">{s.title || "Untitled"}</span>
            </span>
          </button>
        )}

        {!isEditing && (
          <>
            {projectName && (
              <span className="shrink-0 text-[11px] text-sbi-muted-dark bg-sbi-dark-card/60 px-2 py-0.5 rounded-md border border-sbi-dark-border/30 truncate max-w-[10rem]">
                {projectName}
              </span>
            )}
            <span className="shrink-0 text-xs text-sbi-muted-dark whitespace-nowrap">
              {formatRelativeTime(s.updated_at)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Chat options"
                  className={cn(
                    "h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-sbi-muted-dark opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-white hover:bg-sbi-dark-card transition-opacity max-sm:h-10 max-sm:w-10 max-sm:opacity-100",
                  )}
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
          </>
        )}
      </motion.div>
    );
  };

  // ── Filter chip helper ────────────────────────────────────────────────

  const chipClass = (key: FilterKey) =>
    cn(
      "inline-flex items-center px-3 py-1.5 leading-none [text-box-trim:both] [text-box-edge:cap_alphabetic] rounded-md border text-xs transition-colors whitespace-nowrap",
      filter === key
        ? "bg-sbi-green/10 text-sbi-green border-sbi-green/40"
        : "bg-sbi-dark-card text-sbi-muted border-sbi-dark-border/50 hover:border-white/30 hover:text-white",
    );

  // ── Empty state label for active filter ───────────────────────────────

  const filterLabel = () => {
    if (filter === "pinned") return "pinned chats";
    if (filter.startsWith("project-")) {
      const pid = Number(filter.slice(8));
      return projectMap.get(pid) ?? "this project";
    }
    return "chats";
  };

  return (
    <DashboardShell className="max-w-3xl">
      <PageHeader
        title="Chats"
        action={
          <button type="button" onClick={handleNewChat} className={btnPrimary}>
            <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New chat
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-3 shrink-0">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sbi-muted-dark"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title…"
          aria-label="Filter chats by title"
          className={cn(inputClass, "pl-9")}
        />
      </div>

      {/* Filter chips */}
      {projectFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4 shrink-0">
          <button
            type="button"
            className={chipClass("all")}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={chipClass("pinned")}
            onClick={() => setFilter("pinned")}
          >
            Pinned
          </button>
          {projectFilters.map((p) => (
            <button
              key={p.projectId}
              type="button"
              className={chipClass(`project-${p.projectId}`)}
              onClick={() => setFilter(`project-${p.projectId}`)}
            >
              {p.companyName}
            </button>
          ))}
        </div>
      )}

      <Panel className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar">
        {/* Loading skeleton */}
        {loading && <ChatsViewSkeleton />}

        {/* Empty: no chats at all */}
        {!loading && sessionList.length === 0 && (
          <EmptyState
            icon={<MessageSquare size={24} />}
            title="No chats yet"
            description="Start a new chat to explore your project with the AI portal."
            action={
              <button
                type="button"
                onClick={handleNewChat}
                className={btnPrimary}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                New chat
              </button>
            }
          />
        )}

        {/* Empty: filter/search yields nothing */}
        {!loading && sessionList.length > 0 && totalFiltered === 0 && (
          <div className="py-12 text-center text-sm text-sbi-muted-dark">
            {query.trim()
              ? `No ${filterLabel()} match "${query.trim()}".`
              : `No ${filterLabel()}.`}
          </div>
        )}

        {/* Pinned section (within current filter) */}
        {!loading && pinnedInFilter.length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-[11px] tracking-[0.15em] uppercase text-sbi-muted-dark">
              Pinned
            </div>
            <AnimatePresence initial={false}>
              {pinnedInFilter.map(renderRow)}
            </AnimatePresence>
          </div>
        )}

        {/* Date-bucketed groups */}
        {!loading &&
          grouped.map((bucket) => (
            <div key={bucket.label} className="mb-5">
              <div className="mb-1.5 text-[11px] tracking-[0.15em] uppercase text-sbi-muted-dark">
                {bucket.label}
              </div>
              <AnimatePresence initial={false}>
                {bucket.sessions.map(renderRow)}
              </AnimatePresence>
            </div>
          ))}
      </Panel>

      <ConfirmDialog
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete chat"
        description={
          <>
            This permanently deletes{" "}
            <span className="text-white font-medium">
              {deleteTarget?.title || "this chat"}
            </span>{" "}
            and all of its messages. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}
