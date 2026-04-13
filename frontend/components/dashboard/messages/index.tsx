"use client";

import { useEffect, useState } from "react";
import { ConversationList, type Conversation } from "./ConversationList";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/lib/project/project-context";

/** List of conversations only; shown in the middle. Click navigates to /messages/[id]. */
export function Messages() {
  const { user } = useProject();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!user) return;

      const supabase = createClient();

      const { data: convos, error: convoError } = await supabase
        .from("conversations")
        .select("id, director_profile_id")
        .eq("client_profile_id", user.id)
        .order("created_at", { ascending: false });

      if (convoError || !convos || convos.length === 0) {
        setConversations([]);
        return;
      }

      // Batch-fetch director names from profiles
      const directorProfileIds = [...new Set(convos.map((c) => c.director_profile_id).filter(Boolean))] as number[];
      const directorMap = new Map<number, string>();

      if (directorProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", directorProfileIds);

        if (profiles) {
          for (const p of profiles) {
            directorMap.set(p.id, p.name ?? "");
          }
        }
      }

      // Fetch latest message per conversation (parallel, limit 1 each)
      const convoIds = convos.map((c) => c.id);
      const latestMessageMap = new Map<number, { content: string; created_at: string }>();

      await Promise.all(convoIds.map(async (cid) => {
        const { data: latest } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest) {
          latestMessageMap.set(cid as number, {
            content: latest.content ?? "",
            created_at: latest.created_at as string,
          });
        }
      }));

      const result: Conversation[] = convos.map((convo) => {
        const directorName = directorMap.get(convo.director_profile_id as number) || "Director";
        const latest = latestMessageMap.get(convo.id as number);
        return {
          id: String(convo.id),
          name: directorName,
          lastMessage: latest?.content ?? (latest ? "Attachment" : ""),
          timestamp: latest ? new Date(latest.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
        };
      });

      setConversations(result);
    };

    loadConversations();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full">
      <div className="flex-1 flex flex-col w-full justify-start">
        <ConversationList
          conversations={conversations}
          basePath="/dashboard/messages"
          onConversationCreated={(convo) => setConversations((prev) => [convo, ...prev])}
        />
      </div>
    </div>
  );
}