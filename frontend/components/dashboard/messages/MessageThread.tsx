"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { Send, Plus, Check, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ThreadMessage {
  id: number;
  text: string;
  senderRole: "client" | "director";
}

interface MessageThreadProps {
  conversationId?: string | null;
  clientId?: number | null;
  senderRole?: "client" | "director";
  name?: string;
}

// message thread ui for when the user clicks on a specific conversation
export function MessageThread({
  conversationId,
  clientId,
  senderRole = "client",
  name,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      if (!clientId || !conversationId) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, sender_role, created_at")
        .eq("client_id", clientId)
        .eq("conversation_id", Number(conversationId))
        .order("created_at", { ascending: true });

      if (error || !data) {
        return;
      }

      setMessages(
        data.map((row) => ({
          id: row.id,
          text: row.content,
          senderRole: (row.sender_role as "client" | "director") ?? "client",
        })),
      );
    };

    loadMessages();
  }, [clientId, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const cancelEdit = () => {
    setEditingMessageId(null);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    const query = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Edit in place when an existing message is selected
    if (editingMessageId !== null) {
      const previousMessages = messages;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId ? { ...msg, text: query } : msg,
        ),
      );

      if (!clientId) {
        setEditingMessageId(null);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("messages")
        .update({ content: query })
        .eq("id", editingMessageId)
        .eq("client_id", clientId);

      if (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to update message:", error);
        // optional rollback if update fails
        setMessages(previousMessages);
      }

      setEditingMessageId(null);
      return;
    }

    // Optimistic UI update for new message
    const localId = Date.now();
    setMessages((prev) => [...prev, { id: localId, text: query, senderRole }]);

    if (!clientId || !conversationId) {
      // No valid conversation context available; skip persisting.
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      // eslint-disable-next-line no-console
      console.error("Failed to resolve authenticated user for message send:", userError);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        client_id: clientId,
        sender_uid: user.id,
        sender_role: senderRole,
        content: query,
        conversation_id: Number(conversationId),
      })
      .select("id")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to save message:", error);
    } else if (data?.id) {
      // Replace temporary local id with real DB id
      setMessages((prev) =>
        prev.map((msg) => (msg.id === localId ? { ...msg, id: data.id } : msg)),
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && editingMessageId !== null) {
      cancelEdit();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const hasInput = input.trim().length > 0;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Scrollable message list */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-full">
            <p className="text-medium text-gray-500">Write a Message to {name ?? "..."}</p>
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full relative">
            {messages.map((msg) => {
              const isMine = msg.senderRole === senderRole;
              const isEditing = msg.id === editingMessageId;
              const dimOthers = editingMessageId !== null && !isEditing;
              return (
                <div
                  key={msg.id}
                  className={`py-2 flex ${isMine ? "justify-end" : "justify-start"} items-center group transition-opacity ${
                    dimOthers ? "opacity-30" : "opacity-100"
                  }`}
                >
                  {isMine && !isEditing && (
                    <button
                      type="button"
                      className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity text-sbi-muted hover:text-sbi-green cursor-pointer"
                      aria-label="Edit message"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setInput(msg.text);
                        if (textareaRef.current) {
                          textareaRef.current.style.height = "auto";
                        }
                      }}
                    >
                      <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  )}
                  <div className={`inline-block rounded-lg border px-3 py-2 ${isMine ? "border-sbi-green/20 bg-sbi-dark-card/80" : "bg-sbi-green"}`}>
                    <p className="text-sm text-white">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* input bar and send button */}
      <div className="shrink-0 border-t p-4 flex gap-2 items-end">
        <button
          type="button"
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-sbi-dark-border text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark hover:border-sbi-green/30 transition-colors duration-300 cursor-pointer"
          aria-label="Add file (placeholder)"
          title="Add file (coming soon)"
        >
          <Plus className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="text-white flex-1 min-h-[40px] max-h-[200px] resize-none border px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        {hasInput && (
          <>
            {/* Confirm (send/check) */}
            <button
              type="button"
              onClick={handleSubmit}
              className="h-9 w-9 shrink-0 rounded-full transition-transform duration-200 ease-out flex items-center justify-center bg-sbi-green text-sbi-dark hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {editingMessageId !== null ? (
                <Check className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Send className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
            {/* Cancel X – only in edit mode */}
            {editingMessageId !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-sbi-dark-border text-sbi-muted hover:text-red-400 hover:border-red-400 transition-colors duration-200 cursor-pointer"
                aria-label="Cancel edit"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}