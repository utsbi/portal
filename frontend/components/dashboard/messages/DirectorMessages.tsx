"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { ConversationList, type Conversation } from "./ConversationList";
import { CreateConversationModal } from "./CreateConversationModal";
import { useCreateConversationModal } from "./CreateConversationModalContext";
import { fetchReadMap } from "./read-state";
import { createClient } from "@/lib/supabase/client";
import { prefetchConv } from "@/lib/messages/prefetch";
import { setTabUnreadCount } from "@/lib/messages/tab-title";
import { useCmdK } from "./cmdk/CommandPalette";

interface DirectorMessagesProps {
  profileId?: number;
}

export function DirectorMessages({ profileId }: DirectorMessagesProps) {
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

  const context = useCreateConversationModal();
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;

  const loadConversations = useCallback(async () => {
    if (!profileId) return;

    setLoading(true);
    setErrored(false);

    const supabase = createClient();

    const { data: convos, error: convoError } = await supabase
      .from("conversations")
      .select("id, client_profile_id, project_id")
      .eq("director_profile_id", profileId)
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

    // Batch-fetch client names from profiles
    const clientProfileIds = [...new Set(convos.map((c) => c.client_profile_id).filter(Boolean))] as number[];
    const clientMap = new Map<number, string>();

    if (clientProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", clientProfileIds);

      if (profiles) {
        for (const p of profiles) {
          clientMap.set(p.id, p.name ?? "");
        }
      }
    }

    // Batch-fetch project names
    const projectIds = [...new Set(convos.map((c) => c.project_id).filter(Boolean))] as number[];
    const projectMap = new Map<number, string>();
    if (projectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, company_name")
        .in("id", projectIds);
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
      // Resolve peer name; fall back to project/company, never "Client"/ID.
      const clientName = clientMap.get(convo.client_profile_id as number);
      const projectName = convo.project_id ? projectMap.get(convo.project_id as number) : undefined;
      const latest = latestMessageMap.get(convo.id as number);
      const activityMs = latest ? new Date(latest.created_at).getTime() : 0;
      const id = String(convo.id);
      return {
        id,
        name: clientName || projectName || `Conversation ${id}`,
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
  }, [profileId]);

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
  // per-conversation filter (mirrors the proven thread pattern) plus a
  // filtered conversations-insert listener for brand-new conversations.
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
      const fromMe = profileId != null && row.sender_profile_id === profileId;
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
                unread: !fromMe && !isActive,
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
    // single-binding channel per conversation, plus one for new
    // conversation inserts.
    const channels = ids.map((id) => {
      const ch = supabase.channel(`messages:list:director:msg:${id}`);
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

    if (profileId) {
      const convCh = supabase.channel(
        `messages:list:director:conv:${profileId}`,
      );
      convCh.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `director_profile_id=eq.${profileId}`,
        },
        () => {
          loadConversations();
        },
      );
      convCh.subscribe();
      channels.push(convCh);
    }

    return () => {
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [convoIdsKey, loadConversations, profileId]);

  return (
    <div className="flex flex-col min-h-0 h-full w-full">
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <h2 className="text-lg font-light text-white">Messages</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center justify-center p-1 rounded transition-colors cursor-pointer focus:outline-none"
          aria-label="New conversation"
        >
          <MessageSquarePlus
            size={18}
            strokeWidth={1.5}
            className="text-sbi-muted group-hover:text-sbi-green transition-colors"
          />
        </button>
      </div>

      <ConversationList
        conversations={conversations}
        basePath="/dashboard/messages"
        loading={loading}
        errored={errored}
        onRetry={loadConversations}
        onPrefetch={prefetchConv}
      />

      <CreateConversationModal
        opened={open}
        onClose={() => setOpen(false)}
        mode="director"
        profileId={profileId}
        onConversationCreated={(convo) =>
          setConversations((prev) => [convo, ...prev])
        }
      />
    </div>
  );
}
