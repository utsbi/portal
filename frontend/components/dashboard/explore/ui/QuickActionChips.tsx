"use client";

import {
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileBarChart,
  FileSearch,
  FileText,
  HelpCircle,
  Inbox,
} from "lucide-react";
import { useChat } from "@/lib/chat/chat-context";

// Quick-action prompts (formerly the composer's "Tools" dropdown). Each chip
// sends its canned prompt as a chat message through the shared chat context —
// the exact send path a composer submit uses. Rendered only on the new-chat
// welcome state (the parent hides the row once messages exist).
const quickActions: {
  icon: typeof FileText;
  label: string;
  prompt: string;
}[] = [
  {
    icon: FileText,
    label: "Summarize my project",
    prompt: "Summarize my project.",
  },
  {
    icon: ClipboardList,
    label: "Questionnaire status",
    prompt: "What is my questionnaire status?",
  },
  {
    icon: FileBarChart,
    label: "Latest reports",
    prompt: "Show me my latest reports.",
  },
  {
    icon: DollarSign,
    label: "Finance summary",
    prompt: "Give me my project's finance summary.",
  },
  {
    icon: Inbox,
    label: "My requests",
    prompt: "What's the status of my requests?",
  },
  {
    icon: CalendarDays,
    label: "Upcoming events",
    prompt: "What meetings do I have coming up?",
  },
  {
    icon: FileSearch,
    label: "Find a document",
    prompt: "Help me find a document.",
  },
  { icon: HelpCircle, label: "What is SBI?", prompt: "What is SBI?" },
];

/**
 * Single horizontally scrollable row of quick-action pill chips shown above
 * the composer on the new-chat hero. Scrolls on narrow viewports (hidden
 * scrollbar, contained overscroll) and centers itself when the row fits.
 * Chips carry the `.suggestion-chip` class so the welcome screen's GSAP
 * entrance (owned by ExplorePortal) staggers them in.
 */
export function QuickActionChips() {
  const { messages, sendMessage, isLoading } = useChat();
  const isBusy = isLoading || messages.some((m) => m.isStreaming);

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-max items-center gap-2 px-1 py-0.5">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              if (isBusy) return;
              void sendMessage(action.prompt);
            }}
            disabled={isBusy}
            className="suggestion-chip invisible opacity-0 group flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-sbi-dark-border bg-sbi-dark-card/60 px-3 text-xs font-light tracking-wide text-sbi-muted transition-colors duration-300 hover:border-sbi-green/30 hover:text-white active:bg-sbi-dark-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            <action.icon
              className="size-3.5 shrink-0 text-sbi-muted-dark transition-colors duration-300 group-hover:text-sbi-green"
              strokeWidth={1.5}
            />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
