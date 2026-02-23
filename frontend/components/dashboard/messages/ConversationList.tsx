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
            className="group flex items-center justify-center p-1 rounded transition-all duration-300 cursor-pointer focus:outline-none focus:ring-0"
            aria-label="New conversation"
          >
            <div className="text-white group-hover:text-sbi-green transition-all duration-300">
              <MessageSquarePlus size={18} strokeWidth={1.5} />
            </div>
          </button>
        </div>
      )}
      {conversations.filter((convo) => convo.lastMessage !== "").map((convo) => (
        <Link
          key={convo.id}
          href={`${basePath}/${convo.id}`}
          className="group relative block p-3 mb-2 border hover:bg-sbi-dark-card/80 transition-colors duration-300"
        >
          <div className="flex justify-between">
            <span className="text-white text-sm">{convo.name}</span>
            <span className="text-white text-sm">{convo.timestamp}</span>
          </div>
          <p className="text-white text-xs mt-1">{convo.lastMessage}</p>
          {/* Green underline on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-sbi-green scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center" />
        </Link>
      ))}

      {/* Only render client "Select a director" modal when this list owns the create flow. */}
      {showCreateButton && open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-sbi-dark/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-sbi-dark-card/95 rounded-lg p-6 w-96 shadow-xl border border-sbi-dark-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-lg font-medium mb-4">
              Send a Message
            </h2>

            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-xl border border-sbi-dark-border bg-sbi-dark text-white text-sm px-3 py-2 focus:outline-none focus:border-sbi-green/30 focus:ring-1 focus:ring-sbi-green/20"            
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
                className="px-2.5 py-1 text-xs font-medium bg-sbi-green text-white rounded-md hover:bg-sbi-green/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"              
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