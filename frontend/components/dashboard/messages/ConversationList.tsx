"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquarePlus, ChevronDown } from "lucide-react";
import { useCreateConversationModal } from "./CreateConversationModalContext";
import { createClient } from "@/lib/supabase/client";

interface DirectorOption {
  id: number;
  name: string;
  department: string;
}

// Minimal conversation shape required by the list UI.
export interface Conversation {
  id: string;
  department?: string;
  name: string;
  lastMessage: string;
  timestamp: string;
}

// Static department list for the "Select a department" filter.
const departments = [
  "President",
  "Vice President",
  "Project Operations",
  "Engineering",
  "Tech",
  "Business",
  "Public Relations",
  "Architecture",
  "Legal",
];

interface ConversationListProps {
  conversations: Conversation[];
  basePath: string;
  /** When false, header and create modal are omitted so the parent (e.g. DirectorMessages) can render its own header and modal. */
  showCreateButton?: boolean;
  onConversationCreated?: (conversation: Conversation) => void;
}

// display conversations in a list that have a latest message
export function ConversationList({ conversations, basePath, showCreateButton = true, onConversationCreated }: ConversationListProps) {
  const router = useRouter();
  // Use shared context when inside CreateConversationModalProvider so the empty-state button can open this modal; otherwise use local state.
  const context = useCreateConversationModal();
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;
  const [selected, setSelected] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [directors, setDirectors] = useState<DirectorOption[]>([]);

  useEffect(() => {
    if (!open) return;

    const fetchDirectors = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("members")
        .select("id, name, department")
        .eq("role", "director")
        .not("uid", "is", null);

      if (data) setDirectors(data as DirectorOption[]);
    };

    fetchDirectors();
  }, [open]);

  const filteredDirectors =
    selectedDepartment === ""
      ? directors
      : directors.filter((d) => d.department === selectedDepartment);

  const handleNext = async () => {
    if (!selected) return;

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

      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("uid", user.id)
        .single();

      if (clientError || !clientRow) {
        // eslint-disable-next-line no-console
        console.error("Client record not found:", clientError);
        return;
      }

      const { data: conversation, error: convoError } = await supabase
        .from("conversations")
        .insert({
          client_id: clientRow.id,
          director_id: Number(selected),
        })
        .select("id")
        .single();

      if (convoError || !conversation) {
        // eslint-disable-next-line no-console
        console.error("Failed to create conversation:", convoError);
        return;
      }

      const conversationId = conversation.id as number;
      const director = directors.find((d) => d.id === Number(selected));

      onConversationCreated?.({
        id: String(conversationId),
        name: director?.name ?? "Director",
        lastMessage: "",
        timestamp: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      });

      router.push(`${basePath}/${conversationId}`);

      setOpen(false);
      setSelected("");
      setSelectedDepartment("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Unexpected error creating conversation:", err);
    }
  };

  return (
    <div className="p-4 w-full">
      {/* Only show "Messages" + create button when this list owns the create flow (client). */}
      {showCreateButton && (
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
      )}
      {conversations.map((convo) => (
        <Link
          key={convo.id}
          href={`${basePath}/${convo.id}`}
          className="group relative block p-3 mb-2 border hover:bg-sbi-dark-card/80 transition-colors duration-300"
        >
          <div className="flex justify-between">
            <span className="text-white text-sm">{convo.name}</span>
            <span className="text-white text-sm">{convo.timestamp}</span>
          </div>
          <p className="text-white text-xs mt-1">{convo.lastMessage || "No messages yet"}</p>
          {/* Green underline on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-sbi-green scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center" />
        </Link>
      ))}

      {/* Only render client "Select a director" modal when this list owns the create flow. */}
      {showCreateButton && open && (
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

            <div className="relative w-full mb-3">
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelected("");
                }}
                className="w-full appearance-none rounded-xl border border-sbi-dark-border bg-sbi-dark text-white text-sm pl-3 pr-10 py-2 focus:outline-none focus:border-sbi-green/30 focus:ring-1 focus:ring-sbi-green/20"
              >
                <option value="" disabled>
                  Select a department
                </option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white" size={16} />
            </div>

            <div className="relative w-full">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full appearance-none rounded-xl border border-sbi-dark-border bg-sbi-dark text-white text-sm pl-3 pr-10 py-2 focus:outline-none focus:border-sbi-green/30 focus:ring-1 focus:ring-sbi-green/20"
              >
                <option value="" disabled>
                  Select a director
                </option>
                {filteredDirectors.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white" size={16} />
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