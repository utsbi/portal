"use client";

import {
  History,
  MessageSquarePlus,
  MoreHorizontal,
  PanelRightClose,
  Pencil,
  Pin,
  Search,
  Trash2,
} from "lucide-react";
import { motion, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SessionSummary, useChat } from "@/lib/chat/chat-context";
import { cn } from "@/lib/utils";

// Date buckets, in display order. Sessions arrive already sorted by updated_at desc.
const BUCKET_ORDER = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Older",
] as const;
type Bucket = (typeof BUCKET_ORDER)[number];

const PIN_STORAGE_KEY = "chat-history-pinned";

// Notion's sidebar feel: ease + duration lifted from its actual implementation.
const SIDEBAR_WIDTH = 288; // matches w-72
const NOTION_EASE = [0.165, 0.84, 0.44, 1] as const;

// Three states, morphing the SAME element so float->dock tweens smoothly:
//  - hidden: parked off the right edge, transparent
//  - peek:   floating rounded card, inset from the edges, with a drop shadow
//  - locked: docked flush, square corners, no shadow
const panelVariants: Variants = {
  hidden: {
    x: SIDEBAR_WIDTH + 24,
    opacity: 0,
    top: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    boxShadow: "0 24px 60px -12px rgba(0,0,0,0)",
  },
  peek: {
    x: 0,
    opacity: 1,
    top: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    boxShadow: "0 24px 60px -12px rgba(0,0,0,0.75)",
  },
  locked: {
    x: 0,
    opacity: 1,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
    boxShadow: "0 24px 60px -12px rgba(0,0,0,0)",
  },
};

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

export function ChatHistorySidebar() {
  const router = useRouter();
  const {
    listSessions,
    loadSession,
    newSession,
    renameSession,
    deleteSession,
    sessionId,
  } = useChat();

  // Open model (Notion-style): hover to peek (floating overlay), pin to dock.
  const [pinned, setPinned] = useState(false);
  const [peek, setPeek] = useState(false);
  const open = pinned || peek;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Inline rename state.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  // Restore the pinned preference once on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(PIN_STORAGE_KEY) === "1") setPinned(true);
    } catch {}
  }, []);

  // Load the conversation list whenever the panel opens.
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

  const openPeek = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPeek(true);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPeek(false), 180);
  }, [pinned]);

  const togglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PIN_STORAGE_KEY, next ? "1" : "0");
      } catch {}
      if (!next) setPeek(false); // unpinning collapses
      return next;
    });
  };

  const collapseIfFloating = () => {
    if (!pinned) setPeek(false);
  };

  const handleSelect = async (publicId: string) => {
    collapseIfFloating();
    await loadSession(publicId);
    router.replace(`/dashboard/explore?session=${publicId}`, { scroll: false });
  };

  const handleNewChat = () => {
    collapseIfFloating();
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
    if (sessionId === target.id) {
      collapseIfFloating();
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
  const visualState = pinned ? "locked" : peek ? "peek" : "hidden";

  return (
    <>
      {/* Collapsed trigger + edge hover zone (hidden while pinned). */}
      {!pinned && (
        <>
          {/* Invisible full-height strip on the right edge that peeks on hover. */}
          <div
            className="absolute top-0 right-0 z-30 h-full w-3"
            onMouseEnter={openPeek}
          />
          {/* Visible collapsed handle. */}
          <button
            type="button"
            onMouseEnter={openPeek}
            onClick={openPeek}
            aria-label="Open chat history"
            title="Chat history"
            className={cn(
              "absolute top-4 right-4 z-30 h-9 w-9 inline-flex items-center justify-center rounded-full text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark-card/40 transition-opacity duration-150",
              open && "opacity-0 pointer-events-none",
            )}
          >
            <History className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* The panel. One element that morphs between floating-peek and docked-lock
          so the float->dock transition tweens (x, inset, radius, shadow) instead
          of snapping between class sets. */}
      <motion.aside
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        initial={false}
        animate={visualState}
        variants={panelVariants}
        transition={{ duration: 0.3, ease: NOTION_EASE }}
        style={{
          position: "absolute",
          width: SIDEBAR_WIDTH,
          zIndex: 40,
          pointerEvents: open ? "auto" : "none",
        }}
        className="flex flex-col overflow-hidden bg-sbi-dark border border-sbi-dark-border"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <span className="px-1 text-white text-sm font-medium tracking-wide">
            Conversations
          </span>
          <button
            type="button"
            onClick={togglePin}
            title={pinned ? "Close sidebar" : "Lock sidebar open"}
            aria-label={pinned ? "Close sidebar" : "Lock sidebar open"}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-sbi-muted-dark hover:text-white hover:bg-sbi-dark-card/60 transition-colors"
          >
            {pinned ? (
              <PanelRightClose className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Pin className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
        </div>

        <div className="px-3 space-y-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sbi-muted-dark"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full h-8 pl-8 pr-3 rounded-md bg-sbi-dark-card/40 text-[13px] text-white placeholder:text-sbi-muted-dark focus:outline-none focus:bg-sbi-dark-card/70 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-2 h-8 rounded-md text-[13px] text-sbi-muted hover:text-white hover:bg-sbi-dark-card/50 transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.5} />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto dashboard-scrollbar px-2 pt-2 pb-3 mt-1">
          {loading && (
            <div className="px-3 py-3 text-xs text-sbi-muted-dark">
              Loading…
            </div>
          )}
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

          {!loading &&
            grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-sbi-muted-dark">
                  {bucket}
                </div>
                {items.map((s) => {
                  const isActive = sessionId === s.id;
                  const isEditing = editingId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "group/item relative flex items-center rounded-md transition-colors",
                        isActive
                          ? "bg-sbi-dark-card/60"
                          : "hover:bg-sbi-dark-card/50",
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
                            "min-w-0 flex-1 text-left px-2 py-1.5 text-[13px] truncate",
                            isActive
                              ? "text-white"
                              : "text-sbi-muted group-hover/item:text-white",
                          )}
                          title={s.title || "Untitled"}
                        >
                          {s.title || "Untitled"}
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
      </motion.aside>

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
