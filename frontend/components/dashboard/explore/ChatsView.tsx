"use client";

import {
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";

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
  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  // Shares the provider's cached list; fetch once if it hasn't been loaded yet.
  useEffect(() => {
    if (!sessionsLoaded) void refreshSessions();
  }, [sessionsLoaded, refreshSessions]);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  const loading = !sessionsLoaded;

  const { pinnedSessions, otherSessions, filteredCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sessionList.filter((s) =>
          (s.title || "Untitled").toLowerCase().includes(q),
        )
      : sessionList;
    return {
      pinnedSessions: filtered.filter((s) => s.pinned),
      otherSessions: filtered.filter((s) => !s.pinned),
      filteredCount: filtered.length,
    };
  }, [sessionList, query]);

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
  };

  const renderRow = (s: SessionSummary) => {
    const isEditing = editingId === s.id;
    return (
      <div
        key={s.id}
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
            <span className="shrink-0 text-xs text-sbi-muted-dark">
              {formatRelativeTime(s.updated_at)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Conversation options"
                  className={cn(
                    "h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-sbi-muted-dark opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-white hover:bg-sbi-dark-card transition-opacity",
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
      </div>
    );
  };

  return (
    <div className="absolute inset-0 overflow-y-auto dashboard-scrollbar">
      <div className="w-full max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-light tracking-tight text-white">
            Chats
          </h1>
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-sbi-dark-border bg-sbi-dark-card/40 text-sm text-sbi-muted hover:text-sbi-green hover:border-sbi-green/30 transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.5} />
            New chat
          </button>
        </div>

        <div className="relative mb-2">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sbi-muted"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-sbi-dark-card/60 border border-sbi-dark-border text-sm text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40 transition-colors"
          />
        </div>

        {loading && (
          <div className="py-12 text-center text-sm text-sbi-muted-dark">
            Loading…
          </div>
        )}
        {!loading && sessionList.length === 0 && (
          <div className="py-12 text-center text-sm text-sbi-muted-dark">
            No conversations yet.
          </div>
        )}
        {!loading && sessionList.length > 0 && filteredCount === 0 && (
          <div className="py-12 text-center text-sm text-sbi-muted-dark">
            No conversations match “{query.trim()}”.
          </div>
        )}

        {!loading && pinnedSessions.length > 0 && (
          <div className="mb-6">
            <div className="mb-1 text-[11px] tracking-[0.15em] uppercase text-sbi-muted-dark">
              Pinned
            </div>
            <div className="divide-y divide-sbi-dark-border/40">
              {pinnedSessions.map(renderRow)}
            </div>
          </div>
        )}

        {!loading && otherSessions.length > 0 && (
          <div>
            {pinnedSessions.length > 0 && (
              <div className="mb-1 text-[11px] tracking-[0.15em] uppercase text-sbi-muted-dark">
                All chats
              </div>
            )}
            <div className="divide-y divide-sbi-dark-border/40">
              {otherSessions.map(renderRow)}
            </div>
          </div>
        )}
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
