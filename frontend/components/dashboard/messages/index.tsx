"use client";

import { useEffect, useState } from "react";
import { ConversationList, type Conversation } from "./ConversationList";
import { createClient } from "@/lib/supabase/client";
import { useClient } from "@/lib/client/client-context";

interface MessagesProps {
  urlSlug?: string;
}

/** List of conversations only; shown in the middle. Click navigates to /messages/[id]. */
export function Messages({ urlSlug }: MessagesProps) {
  const { client } = useClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!client) return;

      const supabase = createClient();

      const { data: convos, error: convoError } = await supabase
        .from("conversations")
        .select("id, director_id")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (convoError || !convos || convos.length === 0) {
        setConversations([]);
        return;
      }

      // Batch-fetch director names from members
      const directorIds = [...new Set(convos.map((c) => c.director_id).filter(Boolean))] as number[];
      const directorMap = new Map<number, string>();

      if (directorIds.length > 0) {
        const { data: members } = await supabase
          .from("members")
          .select("id, name")
          .in("id", directorIds);

        if (members) {
          for (const m of members) {
            directorMap.set(m.id, m.name ?? "");
          }
        }
      }

      // Batch-fetch latest message per conversation
      const convoIds = convos.map((c) => c.id);
      const latestMessageMap = new Map<number, { content: string; created_at: string }>();

      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false });

      if (messages) {
        for (const msg of messages) {
          const cid = msg.conversation_id as number;
          if (!latestMessageMap.has(cid)) {
            latestMessageMap.set(cid, {
              content: msg.content,
              created_at: msg.created_at as string,
            });
          }
        }
      }

      const result: Conversation[] = convos.map((convo) => {
        const directorName = directorMap.get(convo.director_id as number) || "Director";
        const latest = latestMessageMap.get(convo.id as number);
        return {
          id: String(convo.id),
          name: directorName,
          lastMessage: latest?.content ?? "",
          timestamp: latest ? new Date(latest.created_at).toLocaleTimeString() : "",
        };
      });

      setConversations(result);
    };

    loadConversations();
  }, [client]);

  if (!urlSlug) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full">
      <div className="flex-1 flex flex-col w-full justify-start">
        <ConversationList
          urlSlug={urlSlug}
          conversations={conversations}
          basePath={`/${urlSlug}/dashboard/messages`}
          onConversationCreated={(convo) => setConversations((prev) => [convo, ...prev])}
        />
      </div>
    </div>
  );
}