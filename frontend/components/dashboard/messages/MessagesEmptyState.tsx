"use client";

import { Send } from "lucide-react";
import { useCreateConversationModal } from "./CreateConversationModalContext";

export function MessagesEmptyState() {
  const context = useCreateConversationModal();

  return (
    <div className="flex flex-1 min-h-0 h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full border border-sbi-green text-sbi-green bg-transparent">
          <Send size={26} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-medium text-sbi-muted">Your messages</p>
          <p className="text-sm text-sbi-muted">Send a message to start a chat.</p>
        </div>
        {/* Only show button when inside CreateConversationModalProvider (opens the modal rendered by the list panel). */}
        {context && (
          <button
            type="button"
            onClick={() => context.setOpen(true)}
            className="px-2.5 py-1 text-xs font-medium bg-sbi-green text-white rounded-md hover:bg-sbi-green/90 transition-all duration-300 cursor-pointer"
          >
            Send Message
          </button>
        )}
      </div>
    </div>
  );
}
