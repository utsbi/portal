"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive wrapper for the messages master–detail shell.
 *
 * The active conversation lives in the URL (`/dashboard/messages/[conversationId]`),
 * so this client component reads it via `useParams()` and toggles which pane is
 * visible below the `md` breakpoint:
 *
 * - no conversation selected → the list is full-width, the detail pane is hidden
 * - conversation selected    → the detail pane is full-width, the list is hidden
 *   (DetailPane renders a back-to-list affordance on small screens)
 *
 * From `md` up both panes render side by side, exactly as before. Both panes
 * stay mounted at all times — only visibility changes — so the layout's
 * "mounted once" performance guarantees (see layout.tsx) are preserved.
 */
export function MessagesPanes({
  list,
  detail,
}: {
  list: ReactNode;
  detail: ReactNode;
}) {
  const params = useParams<{ conversationId?: string }>();
  const hasConversation = Boolean(params?.conversationId);

  return (
    <div className="flex flex-1 min-h-0 h-full">
      <div
        className={cn(
          "w-full md:w-96 shrink-0 overflow-hidden md:border-r border-sbi-dark-border/40",
          hasConversation && "hidden md:block",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "flex-1 min-w-0 min-h-0 flex-col overflow-hidden",
          hasConversation ? "flex" : "hidden md:flex",
        )}
      >
        {detail}
      </div>
    </div>
  );
}
