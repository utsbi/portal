"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { Send, Plus, Check, Pencil, X, FileText, Image } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PendingAttachment {
  file: File;
  name: string;
  mimeType: string;
  previewUrl: string | null;
}

interface ThreadMessage {
  id: number;
  text: string | null;
  senderRole: "client" | "director";
  attachmentPath?: string | null;
  attachmentName?: string | null;
  signedUrl?: string | null;
}

interface MessageThreadProps {
  conversationId?: string | null;
  senderRole?: "client" | "director";
  name?: string;
}

// message thread ui for when the user clicks on a specific conversation
export function MessageThread({
  conversationId,
  senderRole = "client",
  name,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, sender_role, created_at, attachment_path, attachment_name")
        .eq("conversation_id", Number(conversationId))
        .order("created_at", { ascending: true });

      if (error || !data) {
        return;
      }

      const mapped: ThreadMessage[] = data.map((row) => ({
        id: row.id,
        text: row.content ?? null,
        senderRole: (row.sender_role as "client" | "director") ?? "client",
        attachmentPath: row.attachment_path ?? null,
        attachmentName: row.attachment_name ?? null,
        signedUrl: null,
      }));

      // Generate signed URLs for any messages that have attachments
      for (const msg of mapped) {
        if (msg.attachmentPath) {
          const { data: urlData } = await supabase.storage
            .from("Message Attachments")
            .createSignedUrl(msg.attachmentPath, 3600);
          msg.signedUrl = urlData?.signedUrl ?? null;
        }
      }

      setMessages(mapped);
    };

    loadMessages();

    // Subscribe to new messages in this conversation via Realtime
    if (!conversationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          const newMsg: ThreadMessage = {
            id: row.id,
            text: row.content ?? null,
            senderRole: (row.sender_role as "client" | "director") ?? "client",
            attachmentPath: row.attachment_path ?? null,
            attachmentName: row.attachment_name ?? null,
            signedUrl: null,
          };
          // Only add if we don't already have this message (from optimistic update)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const cancelEdit = () => {
    setEditingMessageId(null);
    setHoveredMessageId(null);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSubmit = async () => {
    const query = input.trim();
    const hasText = query.length > 0;
    const hasFile = pendingAttachment !== null;

    if (!hasText && !hasFile) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Edit in place when an existing message is selected (text only — no attachment changes)
    if (editingMessageId !== null) {
      if (!hasText) return;
      const previousMessages = messages;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId ? { ...msg, text: query } : msg,
        ),
      );

      const supabase = createClient();
      const { error } = await supabase
        .from("messages")
        .update({ content: query })
        .eq("id", editingMessageId);

      if (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to update message:", error);
        setMessages(previousMessages);
      }

      setEditingMessageId(null);
      setHoveredMessageId(null);
      return;
    }

    if (!conversationId) return;

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

    // Look up sender's profile id
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("uid", user.id)
      .single();

    // --- Attachment send ---
    if (hasFile && pendingAttachment) {
      const attachment = pendingAttachment;
      const storagePath = `${crypto.randomUUID()}-${attachment.name}`;

      // Optimistic UI — show attachment name while uploading
      const localId = Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          text: hasText ? query : null,
          senderRole,
          attachmentName: attachment.name,
          attachmentPath: null,
          signedUrl: attachment.previewUrl,
        },
      ]);
      removePendingAttachment();

      const { error: uploadError } = await supabase.storage
        .from("Message Attachments")
        .upload(storagePath, attachment.file, { upsert: false });

      if (uploadError) {
        // eslint-disable-next-line no-console
        console.error("Failed to upload attachment:", uploadError);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        return;
      }

      const { data: msgData, error: msgError } = await supabase
        .from("messages")
        .insert({
          sender_uid: user.id,
          sender_profile_id: senderProfile?.id ?? null,
          sender_role: senderRole,
          content: hasText ? query : null,
          attachment_path: storagePath,
          attachment_name: attachment.name,
          conversation_id: Number(conversationId),
        })
        .select("id")
        .single();

      if (msgError) {
        // eslint-disable-next-line no-console
        console.error("Failed to save attachment message:", msgError);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
      } else if (msgData?.id) {
        // Generate signed URL now so the sender sees the attachment immediately
        const { data: urlData } = await supabase.storage
          .from("Message Attachments")
          .createSignedUrl(storagePath, 3600);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === localId
              ? { ...msg, id: msgData.id, attachmentPath: storagePath, signedUrl: urlData?.signedUrl ?? attachment.previewUrl }
              : msg,
          ),
        );
      }
      return;
    }

    // --- Text-only send ---
    const localId = Date.now();
    setMessages((prev) => [...prev, { id: localId, text: query, senderRole }]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_uid: user.id,
        sender_profile_id: senderProfile?.id ?? null,
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    setPendingAttachment({
      file,
      name: file.name,
      mimeType: file.type,
      previewUrl,
    });

    // Reset input so same file can be re-selected later
    e.target.value = "";
  };

  const removePendingAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  };

  const hasInput = input.trim().length > 0 || pendingAttachment !== null;

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
              const isHovered = msg.id === hoveredMessageId;
              const dimOthers = editingMessageId !== null && !isEditing;
              return (
                <div
                  key={msg.id}
                  className={`py-2 flex ${isMine ? "justify-end" : "justify-start"} items-center transition-opacity ${
                    dimOthers ? "opacity-30" : "opacity-100"
                  }`}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId((current) => (current === msg.id ? null : current))}
                >
                  {isMine && !isEditing && isHovered && (
                    <button
                      type="button"
                      className="mr-2 transition-opacity text-sbi-muted hover:text-sbi-green cursor-pointer opacity-100"
                      aria-label="Edit message"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setHoveredMessageId(null);
                        setInput(msg.text ?? "");
                        if (textareaRef.current) {
                          textareaRef.current.style.height = "auto";
                        }
                      }}
                    >
                      <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  )}
                  <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                    {(msg.signedUrl || msg.attachmentName) && (
                      <div className={`inline-block rounded-lg border p-1 ${isMine ? "border-sbi-green/20 bg-sbi-dark-card/80" : "bg-sbi-green"}`}>
                        {msg.signedUrl && msg.attachmentName?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                          <img
                            src={msg.signedUrl}
                            alt={msg.attachmentName}
                            className="max-w-[240px] max-h-[240px] rounded object-cover"
                          />
                        ) : msg.signedUrl ? (
                          <a
                            href={msg.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-white underline underline-offset-2 px-2 py-1"
                          >
                            <FileText className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            {msg.attachmentName}
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 px-2 py-1">
                            <FileText className="w-4 h-4 shrink-0 text-sbi-muted" strokeWidth={1.5} />
                            <span className="text-xs text-sbi-muted">{msg.attachmentName}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.text && (
                      <div className={`inline-block rounded-lg border px-3 py-2 ${isMine ? "border-sbi-green/20 bg-sbi-dark-card/80" : "bg-sbi-green"}`}>
                        <p className="text-sm text-white">{msg.text}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* input bar and send button */}
      <div className="shrink-0 border-t p-4 flex flex-col gap-2">
        {/* Pending attachment preview */}
        {pendingAttachment && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sbi-dark-border bg-sbi-dark-card/60 w-fit max-w-full">
            {pendingAttachment.previewUrl ? (
              <img
                src={pendingAttachment.previewUrl}
                alt={pendingAttachment.name}
                className="h-8 w-8 rounded object-cover shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded flex items-center justify-center bg-sbi-dark shrink-0">
                {pendingAttachment.mimeType === "application/pdf" ? (
                  <FileText className="w-4 h-4 text-sbi-muted" strokeWidth={1.5} />
                ) : (
                  <Image className="w-4 h-4 text-sbi-muted" strokeWidth={1.5} />
                )}
              </div>
            )}
            <span className="text-xs text-white truncate max-w-[180px]">{pendingAttachment.name}</span>
            <button
              type="button"
              onClick={removePendingAttachment}
              className="text-sbi-muted hover:text-red-400 transition-colors cursor-pointer shrink-0"
              aria-label="Remove attachment"
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-sbi-dark-border text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark hover:border-sbi-green/30 transition-colors duration-300 cursor-pointer"
            aria-label="Add file"
            onClick={() => fileInputRef.current?.click()}
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
    </div>
  );
}