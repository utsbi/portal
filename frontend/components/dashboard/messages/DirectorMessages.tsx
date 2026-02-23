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
              className="group flex items-center justify-center p-1 rounded transition-all duration-300 cursor-pointer focus:outline-none focus:ring-0"              
              aria-label="New conversation"
            >
              <div className="text-white group-hover:text-sbi-green transition-all duration-300">
                <MessageSquarePlus size={18} strokeWidth={1.5} />
              </div>
            </button>
          </div>
        </div>
        {/* List only; this component provides the header and director "Search for a client" modal. */}
        <ConversationList urlSlug={urlSlug} conversations={fakeDirectorConvo} basePath={`/${urlSlug}/dashboard/team/message`} showCreateButton={false} />
      </div>

      {open && (
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

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a client..."
              className="w-full rounded-xl border border-sbi-dark-border bg-sbi-dark text-white text-sm px-3 py-2 placeholder:text-sbi-muted focus:outline-none focus:border-sbi-green/30 focus:ring-1 focus:ring-sbi-green/20"            
            />

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
