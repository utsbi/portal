"use client";

import gsap from "gsap";
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
import { useEffect, useRef, useState } from "react";
import { listIndexedFiles } from "@/lib/api/knowledge";
import { useChat } from "@/lib/chat/chat-context";
import { useProject } from "@/lib/project/project-context";

interface QuickAction {
  icon: typeof FileText;
  label: string;
  prompt: string;
}

// Quick-action prompts (formerly the composer's "Tools" dropdown). Each chip
// sends its canned prompt as a chat message through the shared chat context —
// the exact send path a composer submit uses. Rendered only on the new-chat
// welcome state (the parent hides the row once messages exist).
const quickActions: QuickAction[] = [
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
 *
 * Grounded starter: when the project has indexed documents, the row leads
 * with a chip naming a real file — a concrete question teaches users the
 * assistant can search THEIR documents in a way canned prompts can't.
 */
export function QuickActionChips() {
  const { messages, sendMessage, isLoading } = useChat();
  const { activeProject } = useProject();
  const projectId = activeProject?.projectId ?? null;
  const isBusy = isLoading || messages.some((m) => m.isStreaming);
  const rowRef = useRef<HTMLDivElement>(null);

  const [actions, setActions] = useState<QuickAction[]>(quickActions);
  const grounded = useRef(false);

  useEffect(() => {
    grounded.current = false;
    setActions(quickActions);
    if (projectId === null) return;
    let cancelled = false;
    listIndexedFiles(projectId)
      .then((files) => {
        if (cancelled || files.length === 0) return;
        const filename = files[0].storage_path.split("/").pop();
        if (!filename) return;
        grounded.current = true;
        setActions([
          {
            icon: FileSearch,
            label: `Summarize ${filename}`,
            prompt: `Summarize ${filename}.`,
          },
          ...quickActions,
        ]);
      })
      .catch(() => {
        // Non-critical: the canned chips remain.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // The grounded chip mounts AFTER the parent's GSAP entrance already ran
  // (async fetch), so it would keep the pre-animation hidden classes forever.
  // autoAlpha clears both opacity and the Tailwind `invisible` class.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when chips re-render
  useEffect(() => {
    if (!grounded.current || !rowRef.current) return;
    const chips = rowRef.current.querySelectorAll(".suggestion-chip");
    gsap.to(chips, { autoAlpha: 1, duration: 0.4, ease: "power3.out" });
  }, [actions]);

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        ref={rowRef}
        className="mx-auto flex w-max items-center gap-2 px-1 py-0.5"
      >
        {actions.map((action) => (
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
