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

      // Get the old clients.id for this user (conversations table still uses old FKs)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: clientRow } = await supabase
        .from("clients")
        .select("id")
        .eq("uid", authUser.id)
        .single();

      if (!clientRow) return;

      const { data: convos, error: convoError } = await supabase
        .from("conversations")
        .select("id, director_id")
        .eq("client_id", clientRow.id)
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
        const directorName = directorMap.get(convo.director_id as number) || "Director";
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