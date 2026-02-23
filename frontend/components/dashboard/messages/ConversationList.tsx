"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import type { Conversation } from "./messages_dataplacholder";
import { useCreateConversationModal } from "./CreateConversationModalContext";

interface ConversationListProps {
  urlSlug: string;
  conversations: Conversation[];
  basePath: string;
  /** When false, header and create modal are omitted so the parent (e.g. DirectorMessages) can render its own header and modal. */
  showCreateButton?: boolean;
}

// display conversations in a list that have a latest message
export function ConversationList({ urlSlug, conversations, basePath, showCreateButton = true }: ConversationListProps) {
  // Use shared context when inside CreateConversationModalProvider so the empty-state button can open this modal; otherwise use local state.
  const context = useCreateConversationModal();
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;
  const [selected, setSelected] = useState("");

  const handleNext = () => {
    setOpen(false);
    setSelected("");
  };

  return (
    <div className="p-4 w-full">
      {/* Only show "Messages" + create button when this list owns the create flow (client). */}
      {showCreateButton && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-white">Messages</h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center shadow-lg"
            aria-label="New conversation"
          >
            <MessageSquarePlus size={18} className="text-white" />
          </button>
        </div>
      )}
      {conversations.filter((convo) => convo.lastMessage !== "").map((convo) => (
        <Link
          key={convo.id}
          href={`${basePath}/${convo.id}`}
          className="block p-3 mb-2 border"
        >
          <div className="flex justify-between">
            <span className="text-white text-sm">{convo.name}</span>
            <span className="text-white text-sm">{convo.timestamp}</span>
          </div>
          <p className="text-white text-xs mt-1">{convo.lastMessage}</p>
        </Link>
      ))}

      {/* Only render client "Select a director" modal when this list owns the create flow. */}
      {showCreateButton && open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gray-800 rounded-lg p-6 w-96 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-lg font-medium mb-4">
              Send a Message
            </h2>

            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none"
            >
              <option value="" disabled>
                Select a director
              </option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded disabled:opacity-50 "
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}