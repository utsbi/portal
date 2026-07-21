"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { fuzzyScore } from "@/lib/messages/search";
import type { Conversation } from "../ConversationList";

// ---- Context ----

interface CmdKContextValue {
  open: () => void;
  setConversations: (convos: Conversation[]) => void;
  /** Snapshot of the conversation list — read-only for downstream consumers
   *  (the conversation-detail page uses it to resolve peer + project names
   *  for its header without a separate server fetch per nav). */
  conversations: Conversation[];
}

const CmdKContext = createContext<CmdKContextValue | null>(null);

export function useCmdK(): CmdKContextValue {
  const ctx = useContext(CmdKContext);
  if (!ctx) throw new Error("useCmdK must be used within CmdKProvider");
  return ctx;
}

/**
 * Non-throwing variant for components that may render outside a CmdKProvider.
 * Returns null when no provider is present instead of throwing, so it can be
 * called unconditionally at the top level (satisfies the rules of hooks).
 */
export function useCmdKOptional(): CmdKContextValue | null {
  return useContext(CmdKContext);
}

// ---- Scoring ----

function scoreConvo(convo: Conversation, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const name = convo.name.toLowerCase();
  const project = (convo.projectName ?? "").toLowerCase();
  const last = convo.lastMessage.toLowerCase();

  // Substring beats subsequence.
  if (name.includes(q)) return 2 + fuzzyScore(name, query);
  if (project.includes(q)) return 1.5 + fuzzyScore(project, query);
  if (last.includes(q)) return 1 + fuzzyScore(last, query);

  // Subsequence fallback.
  const nameScore = fuzzyScore(name, query);
  if (nameScore >= 0) return nameScore;
  const projScore = fuzzyScore(project, query);
  if (projScore >= 0) return projScore * 0.5;
  return -1;
}

// ---- Modal ----

interface PaletteModalProps {
  conversations: Conversation[];
  basePath: string;
  onClose: () => void;
}

function PaletteModal({ conversations, basePath, onClose }: PaletteModalProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = query
    ? conversations
        .map((c) => ({ c, score: scoreConvo(c, query) }))
        .filter(({ score }) => score >= 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (b.c.lastActivity ?? 0) - (a.c.lastActivity ?? 0);
        })
        .map(({ c }) => c)
    : [...conversations].sort(
        (a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0),
      );

  // Keep activeIdx in bounds when filtered list changes.
  const clampedIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1));

  const navigate = useCallback(
    (convo: Conversation) => {
      router.push(`${basePath}/${convo.id}`);
      onClose();
    },
    [router, basePath, onClose],
  );

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[clampedIdx];
      if (target) navigate(target);
    }
  };

  // Scroll active item into view.
  useEffect(() => {
    const item = listRef.current?.children[clampedIdx] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [clampedIdx]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: presentational click-outside backdrop; it carries role="presentation" and only dismisses the modal. Keyboard dismissal is fully covered by the search input's Escape handler (which is auto-focused on open) and the backdrop's own Escape handler.
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh] bg-sbi-dark/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick here only stops backdrop click-to-close propagation; it triggers no action of its own, and keyboard dismissal is handled by the backdrop and the search input's Escape handler */}
      <div
        className="w-[min(520px,calc(100vw-2rem))] max-h-[480px] flex flex-col rounded-xl border border-sbi-dark-border/60 bg-sbi-dark-card shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Switch conversation"
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-sbi-dark-border/40">
          <Search
            className="w-4 h-4 text-sbi-muted-dark shrink-0"
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKey}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-sbi-muted-dark focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-px rounded border border-sbi-dark-border/50 bg-sbi-dark px-1.5 text-[10px] text-sbi-muted-dark">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-sbi-muted-dark">
            No conversations found
          </div>
        ) : (
          <ul
            ref={listRef}
            className="overflow-y-auto flex-1 p-1.5 custom-scrollbar"
          >
            {filtered.map((convo, idx) => (
              <li key={convo.id}>
                <button
                  type="button"
                  onClick={() => navigate(convo)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`w-full flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    idx === clampedIdx
                      ? "bg-sbi-green/10 text-white"
                      : "text-sbi-muted hover:bg-sbi-dark-border/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {convo.name}
                    </span>
                    {convo.timestamp && (
                      <span className="text-[10px] tabular-nums text-sbi-muted-dark shrink-0">
                        {convo.timestamp}
                      </span>
                    )}
                  </div>
                  {(convo.projectName || convo.lastMessage) && (
                    <div className="flex items-center gap-1.5">
                      {convo.projectName && (
                        <span className="text-[10px] text-sbi-green/70 uppercase tracking-[0.04em] shrink-0">
                          {convo.projectName}
                        </span>
                      )}
                      {convo.projectName && convo.lastMessage && (
                        <span className="text-[10px] text-sbi-muted-dark">
                          ·
                        </span>
                      )}
                      {convo.lastMessage && (
                        <span className="text-[11px] text-sbi-muted-dark truncate">
                          {convo.lastMessage}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Provider ----

interface CmdKProviderProps {
  children: ReactNode;
  basePath: string;
}

export function CmdKProvider({ children, basePath }: CmdKProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global Cmd+K / Ctrl+K listener.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const isMac =
        typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CmdKContext.Provider value={{ open, setConversations, conversations }}>
      {children}
      {isOpen && (
        <PaletteModal
          conversations={conversations}
          basePath={basePath}
          onClose={close}
        />
      )}
    </CmdKContext.Provider>
  );
}
