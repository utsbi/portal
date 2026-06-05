"use client";

import {
  History,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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

interface ChatHistorySidebarProps {
  className?: string;
}

export function ChatHistorySidebar({ className }: ChatHistorySidebarProps) {
  const router = useRouter();
  const {
    listSessions,
    loadSession,
    newSession,
    renameSession,
    deleteSession,
    sessionId,
  } = useChat();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Inline rename state.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listSessions()
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, listSessions]);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  const handleSelect = async (id: number) => {
    setOpen(false);
    await loadSession(id);
    router.replace(`/dashboard/explore?session=${id}`, { scroll: false });
  };

  const handleNewChat = () => {
    setOpen(false);
    newSession();
    router.push("/dashboard");
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
    const current = sessions.find((s) => s.id === id);
    if (!next || next === (current?.title || "")) return;
    // Optimistic local update, then persist.
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: next } : s)),
    );
    await renameSession(id, next);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setSessions((prev) => prev.filter((s) => s.id !== target.id));
    await deleteSession(target.id);
    setDeleteTarget(null);
    // If we deleted the conversation that was open, drop back to a fresh portal.
    if (sessionId === target.id) {
      setOpen(false);
      router.push("/dashboard");
    }
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sessions.filter((s) =>
          (s.title || "Untitled").toLowerCase().includes(q),
        )
      : sessions;
    const map = new Map<Bucket, SessionSummary[]>();
    for (const s of filtered) {
      const b = bucketFor(s.updated_at);
      const arr = map.get(b);
      if (arr) arr.push(s);
      else map.set(b, [s]);
    }
    return BUCKET_ORDER.map((b) => [b, map.get(b) ?? []] as const).filter(
      ([, arr]) => arr.length > 0,
    );
  }, [sessions, query]);

  const hasAny = sessions.length > 0;
  const noMatches = hasAny && grouped.length === 0;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark-card/40",
              className,
            )}
            title="Chat history"
            aria-label="Open chat history"
          >
            <History className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="bg-sbi-dark border-sbi-dark-border w-80 p-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-5 pb-3 border-b border-sbi-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white text-sm font-medium tracking-wide">
                Conversations
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="h-7 px-2 text-xs text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark-card/40 gap-1.5"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                New
              </Button>
            </div>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sbi-muted-dark"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full h-8 pl-8 pr-3 rounded-md bg-sbi-dark-card/40 border border-sbi-dark-border text-xs text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40 transition-colors"
              />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto dashboard-scrollbar py-2">
            {loading && (
              <div className="px-4 py-3 text-xs text-sbi-muted-dark">
                Loading…
              </div>
            )}
            {!loading && !hasAny && (
              <div className="px-4 py-6 text-xs text-sbi-muted-dark">
                No conversations yet.
              </div>
            )}
            {!loading && noMatches && (
              <div className="px-4 py-6 text-xs text-sbi-muted-dark">
                No conversations match “{query.trim()}”.
              </div>
            )}

            {!loading &&
              grouped.map(([bucket, items]) => (
                <div key={bucket} className="mb-1">
                  <div className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-sbi-muted-dark">
                    {bucket}
                  </div>
                  {items.map((s) => {
                    const isActive = sessionId === s.id;
                    const isEditing = editingId === s.id;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "group/item relative flex items-center transition-colors",
                          isActive
                            ? "bg-sbi-dark-card/40"
                            : "hover:bg-sbi-dark-card/30",
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
                            className="flex-1 mx-3 my-2 px-2 h-7 rounded bg-sbi-dark border border-sbi-green/40 text-sm text-white focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelect(s.id)}
                            className={cn(
                              "min-w-0 flex-1 text-left px-4 py-3 flex flex-col gap-1",
                              isActive
                                ? "text-white"
                                : "text-sbi-muted group-hover/item:text-white",
                            )}
                          >
                            <span className="line-clamp-2 leading-snug text-sm">
                              {s.title || "Untitled"}
                            </span>
                            <span className="text-[11px] text-sbi-muted-dark">
                              {formatRelativeTime(s.updated_at)}
                            </span>
                          </button>
                        )}

                        {!isEditing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Conversation options"
                                onClick={(e) => e.stopPropagation()}
                                className="mr-2 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-sbi-muted-dark opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 hover:text-white hover:bg-sbi-dark-card/60 transition-opacity"
                              >
                                <MoreHorizontal
                                  className="h-4 w-4"
                                  strokeWidth={1.5}
                                />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-sbi-dark border-sbi-dark-border text-sbi-muted min-w-[8rem]"
                            >
                              <DropdownMenuItem
                                onClick={() => beginRename(s)}
                                className="text-xs gap-2 focus:bg-sbi-dark-card/60 focus:text-white cursor-pointer"
                              >
                                <Pencil
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.5}
                                />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(s)}
                                className="text-xs gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.5}
                                />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
}
