"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { ConversationList, type Conversation } from "./ConversationList";
import { useCreateConversationModal } from "./CreateConversationModalContext";
import { createClient } from "@/lib/supabase/client";

interface DirectorMessagesProps {
  profileId?: number;
}

interface ClientMatch {
  id: number;
  company_name: string;
  url_slug: string;
}

export function DirectorMessages({ profileId }: DirectorMessagesProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!profileId) return;

      const supabase = createClient();

      const { data: convos, error: convoError } = await supabase
        .from("conversations")
        .select("id, client_profile_id")
        .eq("director_profile_id", profileId)
        .order("created_at", { ascending: false });

      if (convoError || !convos || convos.length === 0) {
        setConversations([]);
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
        const clientName = clientMap.get(convo.client_profile_id as number) || "Client";
        const latest = latestMessageMap.get(convo.id as number);
        return {
          id: String(convo.id),
          name: clientName,
          lastMessage: latest?.content ?? (latest ? "Attachment" : ""),
          timestamp: latest ? new Date(latest.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
        };
      });

      setConversations(result);
    };

    loadConversations();
  }, [profileId]);

  // Same context as client flow so MessagesEmptyState "Create a new conversation" opens this modal.
  const context = useCreateConversationModal();
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;
  const [search, setSearch] = useState("");
  const [allClients, setAllClients] = useState<ClientMatch[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientMatch | null>(null);

  useEffect(() => {
    if (!open) return;

    const fetchAllClients = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, url_slug")
        .order("company_name", { ascending: true });

      if (data) setAllClients(data as ClientMatch[]);
    };

    fetchAllClients();
  }, [open]);

  const filteredClients = search.trim().length > 0
    ? allClients.filter((c) =>
        c.company_name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : allClients;

  const handleNext = async () => {
    if (!selectedClient || !profileId) {
      return;
    }

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        // eslint-disable-next-line no-console
        console.error("Not authenticated:", userError);
        return;
      }

      // Look up old member.id for backward compat
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("uid", user.id)
        .eq("role", "director")
        .single();

      // Look up client's profile id
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("uid", (await supabase.from("clients").select("uid").eq("id", selectedClient.id).single()).data?.uid ?? "")
        .maybeSingle();

      const { data: conversation, error: convoError } = await supabase
        .from("conversations")
        .insert({
          client_id: selectedClient.id,
          director_id: member?.id ?? null,
          client_profile_id: clientProfile?.id ?? null,
          director_profile_id: profileId,
        })
        .select("id")
        .single();

      if (convoError || !conversation) {
        // eslint-disable-next-line no-console
        console.error("Failed to create conversation:", convoError);
        return;
      }

      const conversationId = conversation.id as number;

      // Optimistically add to local list so it appears immediately
      setConversations((prev) => [
        {
          id: String(conversationId),
          name: selectedClient.company_name,
          lastMessage: "",
          timestamp: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ]);

      // Navigate to the new conversation thread
      router.push(`/dashboard/messages/${conversationId}`);

      // Reset modal state
      setOpen(false);
      setSearch("");
      setSelectedClient(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Unexpected error creating conversation:", err);
    }
  };

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
        <ConversationList
          conversations={conversations}
          basePath="/dashboard/messages"
          showCreateButton={false}
        />
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

            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-sbi-dark-border bg-sbi-dark-card/95">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setSearch(client.company_name);
                    setSelectedClient(client);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-sbi-dark ${selectedClient?.id === client.id ? "bg-sbi-dark" : ""}`}
                >
                  {client.company_name}
                </button>
              ))}

              {filteredClients.length === 0 && (
                <p className="px-3 py-2 text-xs text-sbi-muted">
                  No clients found
                </p>
              )}
            </div>

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
