"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { fakeDirectorConvo } from "./messages_dataplacholder";
import { useCreateConversationModal } from "./CreateConversationModalContext";

interface DirectorMessagesProps {
  urlSlug?: string;
}

export function DirectorMessages({ urlSlug }: DirectorMessagesProps) {
  if (!urlSlug) return null;

  // Same context as client flow so MessagesEmptyState "Create a new conversation" opens this modal.
  const context = useCreateConversationModal();
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;
  const [search, setSearch] = useState("");

  const handleNext = () => {
    setOpen(false);
    setSearch("");
  };

  // if current user role is Director then display fakeDirectorConvos placeholder data
  return (
    <div className="relative flex-1 flex flex-col min-h-0 h-full w-full">
      <div className="flex-1 flex flex-col w-full justify-start">
        <div className="p-4 w-full">
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
        </div>
        {/* List only; this component provides the header and director "Search for a client" modal. */}
        <ConversationList urlSlug={urlSlug} conversations={fakeDirectorConvo} basePath={`/${urlSlug}/dashboard/team/message`} showCreateButton={false} />
      </div>

      {open && (
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

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a client..."
              className="w-full rounded border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none"
            />

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded disabled:opacity-50"
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
