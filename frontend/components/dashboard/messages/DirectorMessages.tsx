"use client";

import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { fakeDirectorConvo } from "./messages_dataplacholder";

interface DirectorMessagesProps {
  urlSlug?: string;
}

export function DirectorMessages({ urlSlug }: DirectorMessagesProps) {
  if (!urlSlug) return null;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleNext = () => {
    setOpen(false);
    setSearch("");
  };

  // if current user role is Director then display fakeDirectorConvos placeholder data
  return (
    <div className="relative flex-1 flex flex-col min-h-0 h-full w-full">
      <div className="flex-1 flex flex-col w-full justify-start">
        <ConversationList urlSlug={urlSlug} conversations={fakeDirectorConvo} basePath={`/${urlSlug}/dashboard/team/message`} />
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-gray-600 text-white text-2xl flex items-center justify-center shadow-lg"
      >
        +
      </button>

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
