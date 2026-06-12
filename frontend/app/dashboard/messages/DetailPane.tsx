"use client";

import { useParams } from "next/navigation";
import { useActor } from "@/components/dashboard/messages/ActorContext";
import { useCmdK } from "@/components/dashboard/messages/cmdk/CommandPalette";
import { MessageThread } from "@/components/dashboard/messages/MessageThread";

/**
 * Mounted ONCE inside the messages layout. Reads the active conversation
 * id straight from `useParams()` — when the URL changes, this component
 * just re-renders with a new param value instead of unmounting/remounting
 * a route-level page. That eliminates the ~100ms route-transition flash
 * that even client-side page routes incur per nav.
 *
 * MessageThread still gets `key={conversationId}` so it does a clean
 * remount per conv (fresh state, fresh realtime channels), but the
 * tree above it stays stable, so the blank gap is bounded by React's
 * own commit cycle (~1 frame) rather than Next.js's route teardown.
 */
export function DetailPane() {
  const params = useParams<{ conversationId?: string }>();
  const conversationId = params?.conversationId ?? null;

  const actor = useActor();
  const { conversations } = useCmdK();

  // No conversation selected → empty state. Lives here so the route's
  // page.tsx files can be `return null` no-ops.
  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-sm text-sbi-muted">
            Select a conversation from the list to start messaging.
          </p>
        </div>
      </div>
    );
  }

  const role = actor.role;

  const convo = conversations.find((c) => c.id === conversationId);
  const displayName = convo?.name ?? `Conversation ${conversationId}`;
  const projectName = convo?.projectName ?? null;

  return (
    <>
      <div className="shrink-0 px-6 py-4 border-b border-sbi-dark-border/40 bg-sbi-dark-card/30 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sbi-green/20 bg-sbi-green/5 text-sbi-green text-sm font-light select-none">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-base font-light text-white leading-snug truncate">
            {displayName}
          </p>
          {projectName && (
            <p className="text-[0.7rem] tracking-[0.2em] uppercase text-sbi-muted-dark truncate mt-0.5">
              {projectName}
            </p>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <MessageThread
          key={conversationId}
          conversationId={conversationId}
          senderRole={role}
        />
      </div>
    </>
  );
}
