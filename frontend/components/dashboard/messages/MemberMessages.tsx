"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ConversationList, type Conversation } from "./ConversationList";
import { fetchReadMap } from "./read-state";
import { createClient } from "@/lib/supabase/client";
import { prefetchConv } from "@/lib/messages/prefetch";
import { setTabUnreadCount } from "@/lib/messages/tab-title";
import { useCmdK } from "./cmdk/CommandPalette";

interface MemberMessagesProps {
  /** Project ids the member belongs to (read-only scope). */
  projectIds: number[];
}

/**
 * Members are READ-ONLY: they can browse the conversations on their projects
 * but get no create affordance (and no composer in the thread). They never
 * fall into the client compose path.
 */
export function MemberMessages({ projectIds }: MemberMessagesProps) {
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // Feed conversations into Cmd+K palette.
  let cmdK: ReturnType<typeof useCmdK> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    cmdK = useCmdK();
  } catch {
    cmdK = null;
  }
  useEffect(() => {
    if (cmdK && conversations.length > 0) {
      cmdK.setConversations(conversations);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const loadConversations = useCallback(async () => {
    if (projectIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrored(false);

    const supabase = createClient();

    const { data: convos, error: convoError } = await supabase
      .from("conversations")
      .select("id, client_profile_id, director_profile_id, project_id")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (convoError) {
      setErrored(true);
      setLoading(false);
      return;
    }

    if (!convos || convos.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Batch-fetch director names (the member's project-side counterpart shown).
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

    // Batch-fetch project names
    const convoProjectIds = [...new Set(convos.map((c) => c.project_id).filter(Boolean))] as number[];
    const projectMap = new Map<number, string>();
    if (convoProjectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, company_name")
        .in("id", convoProjectIds);
      if (projectsData) {
        for (const p of projectsData) {
          projectMap.set(p.id, p.company_name ?? "");
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

    const readMap = await fetchReadMap();

    const result: Conversation[] = convos.map((convo) => {
      const directorName = directorMap.get(convo.director_profile_id as number);
      const projectName = convo.project_id ? projectMap.get(convo.project_id as number) : undefined;
      const latest = latestMessageMap.get(convo.id as number);
      const activityMs = latest ? new Date(latest.created_at).getTime() : 0;
      const id = String(convo.id);
      return {
        id,
        name: projectName || directorName || `Conversation ${id}`,
        projectName: projectName || undefined,
        lastMessage: latest?.content ?? (latest ? "Attachment" : ""),
        timestamp: latest
          ? new Date(latest.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        unread: activityMs > 0 && activityMs > (readMap[id] ?? 0),
        lastActivity: activityMs,
      };
    });

    setConversations(result);
    setLoading(false);
  }, [projectIds]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Prefetch up to 100 most-recently-active conversations into IDB so
  // switching to them feels instant (no skeleton). Batched 5 at a time to
  // avoid opening 100 simultaneous Supabase connections.
  useEffect(() => {
    if (conversations.length === 0) return;
    const sorted = [...conversations].sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
    const toWarm = sorted.slice(0, 100).map((c) => c.id);

    (async () => {
      for (let i = 0; i < toWarm.length; i += 5) {
        await Promise.all(toWarm.slice(i, i + 5).map((id) => prefetchConv(id)));
      }
    })();
  }, [conversations]);

  // When a conversation becomes the active route, persistently clear its
  // unread in local state (not just visually suppress) — otherwise the
  // green tick reappears the moment you navigate to another conversation.
  useEffect(() => {
    const m = pathname?.match(/\/messages\/(\d+)/);
    const activeId = m ? m[1] : null;
    if (!activeId) return;
    setConversations((prev) =>
      prev.some((c) => c.id === activeId && c.unread)
        ? prev.map((c) => (c.id === activeId ? { ...c, unread: false } : c))
        : prev,
    );
  }, [pathname]);

  // Tab title unread count.
  useEffect(() => {
    const m = pathname?.match(/\/messages\/(\d+)/);
    const activeId = m ? m[1] : null;
    const unreadCount = conversations.filter(
      (c) => c.unread && c.id !== activeId,
    ).length;
    setTabUnreadCount(unreadCount);
    return () => setTabUnreadCount(0);
  }, [conversations, pathname]);

  // Realtime: keep the list live when a message arrives (no reload).
  // Unfiltered postgres_changes does not deliver here, so subscribe with a
  // per-conversation filter (mirrors the proven thread pattern). Members
  // have no resolvable profile id, so any inbound message is treated as
  // unread unless its conversation is the open one. Members span multiple
  // project ids (cannot filter conversations by IN), so brand-new
  // conversations for members require a reload (acceptable edge).
  const convoIdsKey = conversations.map((c) => c.id).sort().join(",");
  useEffect(() => {
    const supabase = createClient();
    const ids = convoIdsKey ? convoIdsKey.split(",") : [];

    const handleMessage = (payload: { new: unknown }) => {
      const row = payload.new as {
        conversation_id: number | string;
        content: string | null;
        created_at: string;
        sender_profile_id: number | null;
      };
      const convoId = String(row.conversation_id);
      const isActive =
        typeof window !== "undefined" &&
        window.location.pathname === `/dashboard/messages/${convoId}`;

      setConversations((prev) => {
        if (!prev.some((c) => c.id === convoId)) {
          loadConversations();
          return prev;
        }
        const activityMs = new Date(row.created_at).getTime();
        const next = prev.map((c) =>
          c.id === convoId
            ? {
                ...c,
                lastMessage: row.content ?? "Attachment",
                timestamp: new Date(row.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                lastActivity: activityMs,
                unread: !isActive,
              }
            : c,
        );
        return next.sort(
          (a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0),
        );
      });
    };

    // Supabase delivers reliably only with ONE postgres_changes binding
    // per channel (the working thread pattern). Multiple bindings on a
    // single channel silently drop events, so use a separate
    // single-binding channel per conversation. Members span multiple
    // projects, so brand-new conversations still need a reload.
    const channels = ids.map((id) => {
      const ch = supabase.channel(`messages:list:member:msg:${id}`);
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        handleMessage,
      );
      ch.subscribe();
      return ch;
    });

    return () => {
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [convoIdsKey, loadConversations]);

  return (
    <div className="flex flex-col min-h-0 h-full w-full">
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <h2 className="text-lg font-light text-white">Messages</h2>
      </div>

      <ConversationList
        conversations={conversations}
        basePath="/dashboard/messages"
        loading={loading}
        errored={errored}
        onRetry={loadConversations}
        onPrefetch={prefetchConv}
      />
    </div>
  );
}
