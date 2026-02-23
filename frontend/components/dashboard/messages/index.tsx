"use client";

import { ConversationList } from "./ConversationList";
import { fakeConvo } from "./messages_dataplacholder";

interface MessagesProps {
  urlSlug?: string;
}

/** List of conversations only; shown in the middle. Click navigates to /messages/[id]. */
export function Messages({ urlSlug }: MessagesProps) {
  if (!urlSlug) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full">
      <div className="flex-1 flex flex-col w-full justify-start">
        <ConversationList urlSlug={urlSlug} conversations={fakeConvo} basePath={`/${urlSlug}/dashboard/messages`} />
      </div>
    </div>
  );
}