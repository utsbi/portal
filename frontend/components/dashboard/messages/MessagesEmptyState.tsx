"use client";

import { useCreateConversationModal } from "./CreateConversationModalContext";

export function MessagesEmptyState() {
  const context = useCreateConversationModal();

  return (
    <div className="flex flex-1 min-h-0 h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-medium text-gray-500">Your messages</p>
        <p className="text-sm text-gray-500 mt-1">Select a conversation to start chatting.</p>
        {/* Only show button when inside CreateConversationModalProvider (opens the modal rendered by the list panel). */}
        {context && (
          <button
            type="button"
            onClick={() => context.setOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded"
          >
            Create a new conversation
          </button>
        )}
      </div>
    </div>
  );
}
