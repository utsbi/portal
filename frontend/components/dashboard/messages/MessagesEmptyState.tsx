"use client";

import { MessageCircle } from "lucide-react";
import { EmptyState, btnPrimary } from "@/components/dashboard/common/ui";
import { useCreateConversationModal } from "./CreateConversationModalContext";

export function MessagesEmptyState() {
  const context = useCreateConversationModal();

  return (
    <EmptyState
      icon={<MessageCircle className="w-6 h-6" strokeWidth={1.5} />}
      title="Pick a conversation"
      description="Select a thread on the left to read or reply, or start a new conversation."
      action={
        context ? (
          <button
            type="button"
            onClick={() => context.setOpen(true)}
            className={btnPrimary}
          >
            New conversation
          </button>
        ) : undefined
      }
    />
  );
}
