"use client";

import Link from "next/link";
import type { Conversation } from "./messages_dataplacholder";

interface ConversationListProps {
  urlSlug: string;
  conversations: Conversation[];
  basePath: string;
}

// display conversations in a list that have a latest message
export function ConversationList({ urlSlug, conversations, basePath }: ConversationListProps) {
  return (
    <div className="p-4 w-full">
      <h2 className="text-lg text-white mb-4">Messages</h2>
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
    </div>
  );
}