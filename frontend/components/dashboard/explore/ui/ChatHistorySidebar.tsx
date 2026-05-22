"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, MessageSquarePlus } from "lucide-react";
import { useChat, type SessionSummary } from "@/lib/chat/chat-context";
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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ChatHistorySidebarProps {
  className?: string;
}

export function ChatHistorySidebar({ className }: ChatHistorySidebarProps) {
  const router = useRouter();
  const { listSessions, loadSession, newSession, sessionId } = useChat();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
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
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-sbi-dark-border space-y-0">
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
        </SheetHeader>

        <div className="flex-1 overflow-y-auto dashboard-scrollbar py-2">
          {loading && (
            <div className="px-4 py-3 text-xs text-sbi-muted-dark">Loading…</div>
          )}
          {!loading && sessions.length === 0 && (
            <div className="px-4 py-6 text-xs text-sbi-muted-dark">
              No conversations yet.
            </div>
          )}
          {!loading &&
            sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id)}
                className={cn(
                  "w-full text-left px-4 py-3 text-sm transition-colors flex flex-col gap-1",
                  sessionId === s.id
                    ? "bg-sbi-dark-card/40 text-white"
                    : "text-sbi-muted hover:bg-sbi-dark-card/30 hover:text-white",
                )}
              >
                <span className="line-clamp-2 leading-snug">
                  {s.title || "Untitled"}
                </span>
                <span className="text-[11px] text-sbi-muted-dark">
                  {formatRelativeTime(s.updated_at)}
                </span>
              </button>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
