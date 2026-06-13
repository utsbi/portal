"use client";

import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Reply,
  RotateCw,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { btnPrimary, EmptyState } from "@/components/dashboard/common/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { signWithCache } from "@/lib/messages/attachment-cache";
import {
  ensureHydrated,
  getCachedConv,
  patchCachedMessages,
  setCachedConv,
} from "@/lib/messages/conv-cache";
import {
  getNotificationPermission,
  notifyNewMessage,
  requestNotificationPermission,
} from "@/lib/messages/notifications";
import { toastError } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation } from "./ConversationList";
import { useCmdK } from "./cmdk/CommandPalette";
import { renderMarkdown } from "./markdown";
import { fetchLastRead, markRead } from "./read-state";

// ---- Types ----

type MessageStatus = "sending" | "sent" | "failed";

interface AttachmentMeta {
  width?: number;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
}

interface Attachment {
  id: number;
  path: string | null;
  name: string;
  mimeType: string | null;
  meta: AttachmentMeta | null;
  signedUrl: string | null;
  localPreviewUrl?: string | null;
  pendingFile?: File | null;
  uploadFailed?: boolean;
}

interface UnfurlData {
  url: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  site_name?: string | null;
}

interface ThreadMessage {
  id: number;
  text: string | null;
  senderRole: "client" | "director" | "member";
  /** Sender's profile id. Ownership ("is this mine") is by identity, not role,
   *  so same-role and group threads render correctly. */
  senderProfileId?: number | null;
  createdAt: string;
  editedAt?: string | null;
  replyToId?: number | null;
  attachments: Attachment[];
  status: MessageStatus;
  isPinned?: boolean;
  pinnedAt?: string | null;
  unfurl?: UnfurlData | null;
}

interface LightboxState {
  attachments: Attachment[];
  index: number;
  signedUrls: Map<string, string>;
  loadingIndex: boolean;
}

interface PendingAttachment {
  file: File;
  name: string;
  mimeType: string;
  previewUrl: string | null;
}

// ---- Helpers ----

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shouldShowDayHeader(
  curr: ThreadMessage,
  prev: ThreadMessage | undefined,
): boolean {
  if (!prev) return true;
  const a = new Date(curr.createdAt);
  const b = new Date(prev.createdAt);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const GROUP_GAP_MS = 5 * 60 * 1000;

type AttachmentKind = "image" | "video" | "audio" | "pdf" | "file";

function attachmentKind(
  name: string | null | undefined,
  mimeType?: string | null,
): AttachmentKind {
  if (mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "pdf";
  }
  if (!name) return "file";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(ext))
    return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "file";
}

async function extractImageMeta(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap !== "undefined") {
      const bmp = await createImageBitmap(file);
      const dims = { width: bmp.width, height: bmp.height };
      bmp.close();
      return dims;
    }
    return await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

// ---- Image grid component ----

interface ImageGridProps {
  images: Attachment[];
  onOpenLightbox: (attachment: Attachment) => void;
}

function ImageGrid({ images, onOpenLightbox }: ImageGridProps) {
  const count = images.length;
  const display = count > 4 ? images.slice(0, 4) : images;
  const overflow = count > 4 ? count - 4 : 0;

  if (count === 1) {
    const img = images[0];
    const url = img.signedUrl ?? img.localPreviewUrl ?? null;
    return (
      <ImageThumb
        attachment={img}
        url={url}
        onOpen={() => onOpenLightbox(img)}
        className="max-w-[280px] max-h-[280px] rounded-xl object-cover block"
        wrapClass="block overflow-hidden rounded-xl cursor-pointer"
      />
    );
  }

  if (count === 2) {
    return (
      <div className="flex gap-1">
        {images.map((img) => {
          const url = img.signedUrl ?? img.localPreviewUrl ?? null;
          return (
            <ImageThumb
              key={img.id}
              attachment={img}
              url={url}
              onOpen={() => onOpenLightbox(img)}
              className="w-[138px] h-[138px] rounded-xl object-cover block"
              wrapClass="block overflow-hidden rounded-xl cursor-pointer shrink-0"
            />
          );
        })}
      </div>
    );
  }

  if (count === 3) {
    const [first, ...rest] = images;
    const url0 = first.signedUrl ?? first.localPreviewUrl ?? null;
    return (
      <div className="flex gap-1">
        <ImageThumb
          attachment={first}
          url={url0}
          onOpen={() => onOpenLightbox(first)}
          className="w-[138px] h-[280px] rounded-xl object-cover block"
          wrapClass="block overflow-hidden rounded-xl cursor-pointer shrink-0"
        />
        <div className="flex flex-col gap-1">
          {rest.map((img) => {
            const url = img.signedUrl ?? img.localPreviewUrl ?? null;
            return (
              <ImageThumb
                key={img.id}
                attachment={img}
                url={url}
                onOpen={() => onOpenLightbox(img)}
                className="w-[138px] h-[138px] rounded-xl object-cover block"
                wrapClass="block overflow-hidden rounded-xl cursor-pointer shrink-0"
              />
            );
          })}
        </div>
      </div>
    );
  }

  // 4+ images: 2×2 grid, 4th tile shows "+N more" overlay if >4.
  return (
    <div className="grid grid-cols-2 gap-1">
      {display.map((img, tileIdx) => {
        const url = img.signedUrl ?? img.localPreviewUrl ?? null;
        const isLastWithOverflow = tileIdx === 3 && overflow > 0;
        const targetImg = isLastWithOverflow ? images[3] : img;
        return (
          <button
            key={img.id}
            type="button"
            onClick={() => onOpenLightbox(targetImg)}
            className="relative block overflow-hidden rounded-xl cursor-pointer"
            aria-label={
              isLastWithOverflow
                ? `Show all ${count} images`
                : "Open image preview"
            }
          >
            {url ? (
              <img
                src={url}
                alt={img.name}
                loading="lazy"
                decoding="async"
                width={img.meta?.width}
                height={img.meta?.height}
                className="w-[138px] h-[138px] object-cover block"
              />
            ) : (
              <div className="w-[138px] h-[138px] flex items-center justify-center bg-sbi-dark-card/70">
                <ImageIcon
                  className="w-6 h-6 text-sbi-muted"
                  strokeWidth={1.75}
                />
              </div>
            )}
            {isLastWithOverflow && (
              <div className="absolute inset-0 flex items-center justify-center bg-sbi-dark/70 rounded-xl">
                <span className="text-white text-sm font-semibold">
                  +{overflow}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ImageThumbProps {
  attachment: Attachment;
  url: string | null;
  onOpen: () => void;
  className: string;
  wrapClass: string;
}

function ImageThumb({
  attachment,
  url,
  onOpen,
  className,
  wrapClass,
}: ImageThumbProps) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-sbi-dark-border/60 bg-sbi-dark-card px-3 py-2.5 opacity-60">
        <ImageIcon
          className="w-4 h-4 shrink-0 text-sbi-muted"
          strokeWidth={1.75}
        />
        <span className="truncate max-w-[200px] text-xs text-sbi-muted">
          {attachment.name}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={wrapClass}
      aria-label="Open image preview"
    >
      <img
        src={url}
        alt={attachment.name}
        loading="lazy"
        decoding="async"
        width={attachment.meta?.width}
        height={attachment.meta?.height}
        className={className}
        style={
          attachment.meta?.width && attachment.meta?.height
            ? {
                aspectRatio: `${attachment.meta.width} / ${attachment.meta.height}`,
              }
            : undefined
        }
      />
    </button>
  );
}

// ---- Attachment bubble renderer ----

interface AttachmentBubblesProps {
  attachments: Attachment[];
  onOpenLightbox: (attachment: Attachment) => void;
}

function AttachmentBubbles({
  attachments,
  onOpenLightbox,
}: AttachmentBubblesProps) {
  if (attachments.length === 0) return null;

  const imageGroup: Attachment[] = [];
  const nonImages: Attachment[] = [];
  for (const a of attachments) {
    if (attachmentKind(a.name, a.mimeType) === "image") {
      imageGroup.push(a);
    } else {
      nonImages.push(a);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {imageGroup.length > 0 && (
        <ImageGrid images={imageGroup} onOpenLightbox={onOpenLightbox} />
      )}
      {nonImages.map((a) => {
        const kind = attachmentKind(a.name, a.mimeType);
        const url = a.signedUrl ?? a.localPreviewUrl ?? null;
        if (kind === "video" && url) {
          return (
            <video
              key={a.id}
              src={url}
              controls
              preload="metadata"
              className="max-w-[320px] max-h-[280px] rounded-xl"
            />
          );
        }
        if (kind === "audio" && url) {
          return <audio key={a.id} src={url} controls className="w-[260px]" />;
        }
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-sbi-dark-border/60 bg-sbi-dark-card px-3 py-2.5"
          >
            {kind === "pdf" ? (
              <FileText
                className="w-4 h-4 shrink-0 text-sbi-muted"
                strokeWidth={1.75}
              />
            ) : (
              <FileIcon
                className="w-4 h-4 shrink-0 text-sbi-muted"
                strokeWidth={1.75}
              />
            )}
            <span className="truncate max-w-[200px] text-xs text-white">
              {a.name}
            </span>
            {url &&
              (kind === "pdf" ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sbi-green hover:underline underline-offset-2 cursor-pointer"
                >
                  Open
                </a>
              ) : (
                <a
                  href={url}
                  download
                  className="text-xs text-sbi-green hover:underline underline-offset-2 cursor-pointer"
                >
                  Download
                </a>
              ))}
          </div>
        );
      })}
    </div>
  );
}

// ---- Unfurl card ----

function UnfurlCard({ unfurl }: { unfurl: UnfurlData }) {
  const [imageError, setImageError] = useState(false);
  return (
    <a
      href={unfurl.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-stretch max-w-[420px] rounded-lg overflow-hidden border border-sbi-dark-border/60 bg-sbi-dark-card/40 hover:bg-sbi-dark-card/70 hover:border-sbi-green/30 transition-colors cursor-pointer"
    >
      <div className="w-1 bg-sbi-green/60 shrink-0" />
      <div className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {unfurl.site_name && (
            <div className="text-[10px] uppercase tracking-[0.08em] text-sbi-muted-dark font-medium mb-0.5">
              {unfurl.site_name}
            </div>
          )}
          {unfurl.title && (
            <div className="text-sm text-white font-semibold leading-snug line-clamp-2">
              {unfurl.title}
            </div>
          )}
          {unfurl.description && (
            <div className="text-xs text-sbi-muted line-clamp-2 mt-1 leading-snug">
              {unfurl.description}
            </div>
          )}
        </div>
        {!imageError && unfurl.image_url && (
          <img
            src={unfurl.image_url}
            alt=""
            onError={() => setImageError(true)}
            className="w-16 h-16 rounded object-cover shrink-0"
          />
        )}
      </div>
    </a>
  );
}

// ---- Pinned strip ----

interface PinnedStripProps {
  pinnedMessages: ThreadMessage[];
  onJump: (id: number) => void;
}

function PinnedStrip({ pinnedMessages, onJump }: PinnedStripProps) {
  const [expanded, setExpanded] = useState(false);
  const n = pinnedMessages.length;
  if (n === 0) return null;

  return (
    <div className="shrink-0 border-b border-sbi-dark-border/30 bg-sbi-dark/95 backdrop-blur z-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-sbi-dark-card/30 transition-colors"
      >
        <Pin
          className="w-3.5 h-3.5 text-sbi-green/80 shrink-0"
          strokeWidth={1.75}
        />
        <span className="text-[11px] text-sbi-muted-dark flex-1 text-left">
          {n} pinned message{n > 1 ? "s" : ""}
        </span>
        <ChevronUp
          className={`w-3.5 h-3.5 text-sbi-muted-dark transition-transform ${expanded ? "" : "rotate-180"}`}
          strokeWidth={1.75}
        />
      </button>
      {expanded && (
        <div className="flex flex-col gap-0.5 pb-2 px-3">
          {pinnedMessages.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onJump(m.id);
                setExpanded(false);
              }}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sbi-dark-card/50 transition-colors cursor-pointer"
            >
              <Pin
                className="w-3 h-3 text-sbi-green/60 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.04em] text-sbi-muted-dark mb-0.5">
                  {m.senderRole === "director"
                    ? "Director"
                    : m.senderRole === "member"
                      ? "Member"
                      : "Client"}
                </div>
                <div className="text-[11px] text-white truncate">
                  {m.text || "(attachment)"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Notification permission prompt ----

interface PermissionPromptProps {
  onEnable: () => void;
  onDismiss: () => void;
}

function PermissionPrompt({ onEnable, onDismiss }: PermissionPromptProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-sbi-dark-border/60 bg-sbi-dark-card/70 text-[11px]">
      <span className="text-sbi-muted-dark">
        Get notified when new messages arrive
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onEnable}
          className="text-sbi-green hover:underline underline-offset-2 cursor-pointer"
        >
          Enable notifications
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sbi-muted hover:text-white transition-colors cursor-pointer"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ---- Props ----

interface MessageThreadProps {
  conversationId?: string | null;
  senderRole?: "client" | "director" | "member";
  readOnly?: boolean;
  basePath?: string;
  /** Conversations array to feed into Cmd+K switcher (optional). */
  conversations?: Conversation[];
}

// ---- Pagination constants ----
const PAGE_SIZE = 50;
const FIRST_ITEM_OFFSET = 1_000_000;

// ---- Component ----

export function MessageThread({
  conversationId,
  senderRole = "client",
  readOnly = false,
  basePath = "/dashboard/messages",
  conversations,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Synchronously read the in-memory cache during mount so a cache hit paints
  // on the FIRST render — no `loading=true` flash, no stale prior-conv state.
  // Combined with `key={conversationId}` at the call site, switching convs
  // forces a fresh mount that immediately renders cached content if available.
  const initialCache = conversationId ? getCachedConv(conversationId) : null;
  const [messages, setMessages] = useState<ThreadMessage[]>(
    () => (initialCache?.messages as ThreadMessage[] | undefined) ?? [],
  );
  const [loading, setLoading] = useState(() => !initialCache);
  const [loadError, setLoadError] = useState(false);

  // Virtuoso
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(FIRST_ITEM_OFFSET);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Seed from cache: if we have fewer than a full page of messages cached, we
  // know there are no older messages on the server — don't let Virtuoso's
  // start-reached event trigger a useless fetch (and spinner flash) on mount
  // for short conversations whose entire content fits in the viewport.
  const noMoreOlder = useRef(
    !!initialCache &&
      (initialCache.messages as ThreadMessage[]).length < PAGE_SIZE,
  );
  // Track the oldest createdAt we've loaded for the "load older" cursor.
  // Seeded from cache so a remount-on-conv-switch starts with the right cursor.
  const oldestCreatedAt = useRef<string | null>(
    (initialCache?.messages[0] as ThreadMessage | undefined)?.createdAt ?? null,
  );

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [composerMultiline, setComposerMultiline] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // ---- Phase C state ----
  const [senderProfileId, setSenderProfileId] = useState<number | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presenceChannelRef = useRef<any>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<number | null>(null);
  const [hasSentInSession, setHasSentInSession] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  // ---- Phase D: In-thread search ----
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]); // message ids
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadSurfaceRef = useRef<HTMLDivElement>(null);

  // ---- Cmd+K ----
  let cmdK: ReturnType<typeof useCmdK> | null = null;
  try {
    // useCmdK may throw if provider is absent (e.g. storybook / test)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    cmdK = useCmdK();
  } catch {
    cmdK = null;
  }

  // Feed conversations into the Cmd+K palette when provided.
  useEffect(() => {
    if (cmdK && conversations && conversations.length > 0) {
      cmdK.setConversations(conversations);
    }
  }, [cmdK, conversations]);

  // Seeded from cache so the NEW-divider is already in place on first paint
  // when remounting on conv switch — no recomputation flash.
  const newDividerBeforeId = useRef<number | null>(
    initialCache?.newDividerBeforeId ?? null,
  );
  const dividerComputedForConv = useRef<string | null>(
    initialCache && conversationId ? conversationId : null,
  );
  const aliveRef = useRef(true);

  // ---- Scroll helpers (Virtuoso-aware) ----

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    void behavior;
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      behavior: "smooth",
    });
    setHasNew(false);
  }, []);

  // ---- jumpToMessage ----

  const jumpToMessage = useCallback((id: number) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx >= 0) {
        virtuosoRef.current?.scrollToIndex({
          index: idx,
          align: "center",
          behavior: "smooth",
        });
      }
      return prev;
    });
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedMsgId(id);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMsgId(null);
      highlightTimerRef.current = null;
    }, 1500);
  }, []);

  // ---- loadOlder (prepend-on-scroll-up) ----

  const loadOlder = useCallback(async () => {
    if (
      loadingOlder ||
      noMoreOlder.current ||
      !conversationId ||
      !oldestCreatedAt.current
    )
      return;
    setLoadingOlder(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .select(
        "id, content, sender_role, sender_profile_id, created_at, edited_at, reply_to_id, is_pinned, pinned_at, message_attachments(id, path, name, mime_type, meta, sort_index), message_unfurls(url, title, description, image_url, site_name)",
      )
      .eq("conversation_id", Number(conversationId))
      .lt("created_at", oldestCreatedAt.current)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!aliveRef.current) return;
    setLoadingOlder(false);

    if (error || !data) return;

    if (data.length < PAGE_SIZE) {
      noMoreOlder.current = true;
    }

    if (data.length === 0) return;

    // Sort ascending (oldest first), then prepend.
    const sorted = [...data].sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime(),
    );

    const mapped: ThreadMessage[] = sorted.map((row) => {
      const rawAttachments = Array.isArray(row.message_attachments)
        ? row.message_attachments
        : [];
      const attachments: Attachment[] = rawAttachments
        .slice()
        .sort(
          (a: { sort_index: number }, b: { sort_index: number }) =>
            a.sort_index - b.sort_index,
        )
        .map(
          (a: {
            id: number;
            path: string;
            name: string;
            mime_type: string | null;
            meta: unknown;
          }) => ({
            id: a.id,
            path: a.path,
            name: a.name,
            mimeType: a.mime_type,
            meta: (a.meta as AttachmentMeta | null) ?? null,
            signedUrl: null,
          }),
        );
      // PostgREST returns 1:1 joins (message_unfurls.message_id is the PK
      // referencing messages.id) as a SINGLE object — not an array. Treat
      // both shapes so we don't drop the unfurl on the array-only path.
      const rawUnfurl = row.message_unfurls as
        | UnfurlData
        | UnfurlData[]
        | null
        | undefined;
      const firstUnfurl: UnfurlData | undefined = Array.isArray(rawUnfurl)
        ? rawUnfurl[0]
        : (rawUnfurl ?? undefined);
      return {
        id: row.id,
        text: row.content ?? null,
        senderRole:
          (row.sender_role as "client" | "director" | "member") ?? "client",
        senderProfileId: (row.sender_profile_id as number | null) ?? null,
        createdAt: (row.created_at as string) ?? new Date().toISOString(),
        editedAt:
          ((row as Record<string, unknown>).edited_at as string | null) ?? null,
        replyToId:
          ((row as Record<string, unknown>).reply_to_id as number | null) ??
          null,
        attachments,
        status: "sent" as const,
        isPinned: Boolean((row as Record<string, unknown>).is_pinned),
        pinnedAt:
          ((row as Record<string, unknown>).pinned_at as string | null) ?? null,
        unfurl: firstUnfurl ?? null,
      };
    });

    // Update oldest cursor.
    oldestCreatedAt.current = mapped[0].createdAt;

    setFirstItemIndex((prev) => prev - mapped.length);
    setMessages((prev) => [...mapped, ...prev]);

    // Sign any attachment paths in background.
    const paths: string[] = [];
    for (const m of mapped) {
      for (const a of m.attachments) {
        if (a.path) paths.push(a.path);
      }
    }
    if (paths.length > 0) {
      const cli = createClient();
      signWithCache(cli, paths, { width: 560, quality: 75 })
        .then((urlMap) => {
          if (!aliveRef.current) return;
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              attachments: m.attachments.map((a) =>
                a.path && urlMap.has(a.path)
                  ? { ...a, signedUrl: urlMap.get(a.path) ?? null }
                  : a,
              ),
            })),
          );
        })
        .catch(() => {});
    }
  }, [conversationId, loadingOlder]);

  // ---- loadMessages (initial, paginated) ----

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    setLoadError(false);

    const hasCached = !!getCachedConv(conversationId);
    if (!hasCached) {
      setLoading(true);
      setMessages([]);
    }

    const supabase = createClient();

    const [msgsRes, lastReadMs, readsRes] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "id, content, sender_role, sender_profile_id, created_at, edited_at, reply_to_id, is_pinned, pinned_at, message_attachments(id, path, name, mime_type, meta, sort_index), message_unfurls(url, title, description, image_url, site_name)",
        )
        .eq("conversation_id", Number(conversationId))
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      fetchLastRead(conversationId),
      supabase
        .from("conversation_reads")
        .select("profile_id, last_read_at")
        .eq("conversation_id", Number(conversationId)),
    ]);

    if (!aliveRef.current) return;

    if (readsRes.data && senderProfileId !== null) {
      const otherRow = readsRes.data.find(
        (r) => r.profile_id !== senderProfileId,
      );
      if (otherRow?.last_read_at) {
        setOtherLastReadAt(new Date(otherRow.last_read_at as string).getTime());
      }
    }

    if (msgsRes.error || !msgsRes.data) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    // Data came back DESC; sort ASC for display.
    const sorted = [...msgsRes.data].sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime(),
    );

    if (sorted.length < PAGE_SIZE) {
      noMoreOlder.current = true;
    } else {
      noMoreOlder.current = false;
    }

    const mapped: ThreadMessage[] = sorted.map((row) => {
      const rawAttachments = Array.isArray(row.message_attachments)
        ? row.message_attachments
        : [];
      const attachments: Attachment[] = rawAttachments
        .slice()
        .sort(
          (a: { sort_index: number }, b: { sort_index: number }) =>
            a.sort_index - b.sort_index,
        )
        .map(
          (a: {
            id: number;
            path: string;
            name: string;
            mime_type: string | null;
            meta: unknown;
          }) => ({
            id: a.id,
            path: a.path,
            name: a.name,
            mimeType: a.mime_type,
            meta: (a.meta as AttachmentMeta | null) ?? null,
            signedUrl: null,
          }),
        );
      // PostgREST returns 1:1 joins (message_unfurls.message_id is the PK
      // referencing messages.id) as a SINGLE object — not an array. Treat
      // both shapes so we don't drop the unfurl on the array-only path.
      const rawUnfurl = row.message_unfurls as
        | UnfurlData
        | UnfurlData[]
        | null
        | undefined;
      const firstUnfurl: UnfurlData | undefined = Array.isArray(rawUnfurl)
        ? rawUnfurl[0]
        : (rawUnfurl ?? undefined);
      return {
        id: row.id,
        text: row.content ?? null,
        senderRole:
          (row.sender_role as "client" | "director" | "member") ?? "client",
        senderProfileId: (row.sender_profile_id as number | null) ?? null,
        createdAt: (row.created_at as string) ?? new Date().toISOString(),
        editedAt:
          ((row as Record<string, unknown>).edited_at as string | null) ?? null,
        replyToId:
          ((row as Record<string, unknown>).reply_to_id as number | null) ??
          null,
        attachments,
        status: "sent" as const,
        isPinned: Boolean((row as Record<string, unknown>).is_pinned),
        pinnedAt:
          ((row as Record<string, unknown>).pinned_at as string | null) ?? null,
        unfurl: firstUnfurl ?? null,
      };
    });

    // Set the oldest cursor for "load older" prepend.
    oldestCreatedAt.current = mapped[0]?.createdAt ?? null;
    // Reset firstItemIndex for a fresh conversation load.
    setFirstItemIndex(FIRST_ITEM_OFFSET);

    setMessages(mapped);
    setLoading(false);

    // Sign attachment thumbnails in background.
    const allPaths: string[] = [];
    for (const m of mapped) {
      for (const a of m.attachments) {
        if (a.path) allPaths.push(a.path);
      }
    }

    if (allPaths.length > 0) {
      const urlMap = await signWithCache(supabase, allPaths, {
        width: 560,
        quality: 75,
      });
      if (!aliveRef.current) return;
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          attachments: m.attachments.map((a) =>
            a.path && urlMap.has(a.path)
              ? { ...a, signedUrl: urlMap.get(a.path) ?? null }
              : a,
          ),
        })),
      );
    }

    // Compute new-message divider.
    if (dividerComputedForConv.current !== conversationId) {
      newDividerBeforeId.current = null;
      const firstUnseenPeer = mapped.find(
        (m) =>
          m.senderProfileId !== senderProfileId &&
          new Date(m.createdAt).getTime() > lastReadMs,
      );
      newDividerBeforeId.current = firstUnseenPeer?.id ?? null;
      dividerComputedForConv.current = conversationId;
    }

    setCachedConv(conversationId, {
      messages: mapped,
      lastRead: lastReadMs,
      cachedAt: Date.now(),
      newDividerBeforeId: newDividerBeforeId.current,
    });

    if (mapped.length > 0) {
      void markRead(conversationId);
    }
  }, [conversationId, senderRole, senderProfileId]);

  // ---- Realtime subscriptions ----

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;

    // If we mounted without an in-memory cache hit (initial state was empty
    // because IDB hadn't hydrated yet), wait for hydration and then patch
    // state from the now-populated cache. Skip entirely when initialCache
    // already supplied the data — the first render is already correct.
    if (conversationId && !initialCache) {
      ensureHydrated().then(() => {
        if (cancelled || !aliveRef.current) return;
        const cached = getCachedConv(conversationId);
        if (cached) {
          setMessages(cached.messages as ThreadMessage[]);
          newDividerBeforeId.current = cached.newDividerBeforeId;
          dividerComputedForConv.current = conversationId;
          setLoading(false);
          const msgs = cached.messages as ThreadMessage[];
          oldestCreatedAt.current = msgs[0]?.createdAt ?? null;
        }
      });
    }

    if (!conversationId) {
      loadMessages();
      return () => {
        cancelled = true;
        aliveRef.current = false;
      };
    }

    const supabase = createClient();

    // INSERT channel.
    const msgChannel = supabase
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
          const row = payload.new as {
            id: number;
            content: string | null;
            sender_role: string;
            sender_profile_id: number | null;
            created_at: string;
            edited_at: string | null;
            reply_to_id: number | null;
            is_pinned: boolean | null;
            pinned_at: string | null;
          };
          const newMsg: ThreadMessage = {
            id: row.id,
            text: row.content ?? null,
            senderRole:
              (row.sender_role as "client" | "director" | "member") ?? "client",
            senderProfileId: (row.sender_profile_id as number | null) ?? null,
            createdAt: (row.created_at as string) ?? new Date().toISOString(),
            editedAt: row.edited_at ?? null,
            replyToId: row.reply_to_id ?? null,
            attachments: [],
            status: "sent",
            isPinned: Boolean(row.is_pinned),
            pinnedAt: row.pinned_at ?? null,
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const next = [...prev, newMsg];
            patchCachedMessages(conversationId, next);
            return next;
          });
          if (atBottom) {
            requestAnimationFrame(() => scrollToBottom());
          } else {
            setHasNew(true);
          }
          void markRead(conversationId);

          if (
            typeof document !== "undefined" &&
            document.hidden &&
            newMsg.senderProfileId !== senderProfileId &&
            getNotificationPermission() === "granted"
          ) {
            notifyNewMessage({
              title:
                senderRole === "director"
                  ? "New message from client"
                  : "New message from director",
              body: newMsg.text || "(attachment)",
              convId: conversationId,
              href: `${basePath}/${conversationId}`,
            });
          }
        },
      )
      .subscribe();

    // UPDATE channel (edits, pins, etc.).
    const msgUpdateChannel = supabase
      .channel(`messages:conversation:update:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: number;
            content: string | null;
            edited_at: string | null;
            reply_to_id: number | null;
            is_pinned: boolean | null;
            pinned_at: string | null;
          };
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    text: row.content ?? null,
                    editedAt: row.edited_at ?? null,
                    replyToId: row.reply_to_id ?? null,
                    isPinned: Boolean(row.is_pinned),
                    pinnedAt: row.pinned_at ?? null,
                  }
                : m,
            );
            patchCachedMessages(conversationId, next);
            return next;
          });
        },
      )
      .subscribe();

    // Attachment INSERT channel.
    const attachChannel = supabase
      .channel(`messages:attachments:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_attachments",
        },
        (payload) => {
          const row = payload.new as {
            id: number;
            message_id: number;
            path: string;
            name: string;
            mime_type: string | null;
            meta: unknown;
            sort_index: number;
          };
          setMessages((prev) => {
            const target = prev.find((m) => m.id === row.message_id);
            if (!target) return prev;
            if (target.attachments.some((a) => a.id === row.id)) return prev;
            const newAttachment: Attachment = {
              id: row.id,
              path: row.path,
              name: row.name,
              mimeType: row.mime_type,
              meta: (row.meta as AttachmentMeta | null) ?? null,
              signedUrl: null,
            };
            const next = prev.map((m) =>
              m.id === row.message_id
                ? { ...m, attachments: [...m.attachments, newAttachment] }
                : m,
            );
            patchCachedMessages(conversationId, next);
            const cli = createClient();
            signWithCache(cli, [row.path], { width: 560, quality: 75 })
              .then((urlMap) => {
                const signed = urlMap.get(row.path) ?? null;
                if (signed) {
                  setMessages((p) =>
                    p.map((m) =>
                      m.id === row.message_id
                        ? {
                            ...m,
                            attachments: m.attachments.map((a) =>
                              a.id === row.id ? { ...a, signedUrl: signed } : a,
                            ),
                          }
                        : m,
                    ),
                  );
                }
              })
              .catch(() => {});
            return next;
          });
        },
      )
      .subscribe();

    // Unfurls INSERT channel.
    const unfurlChannel = supabase
      .channel(`unfurls:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_unfurls",
        },
        (payload) => {
          const row = payload.new as {
            message_id: number;
            url: string;
            title: string | null;
            description: string | null;
            image_url: string | null;
            site_name: string | null;
          };
          setMessages((prev) => {
            const target = prev.find((m) => m.id === row.message_id);
            if (!target) return prev;
            return prev.map((m) =>
              m.id === row.message_id
                ? {
                    ...m,
                    unfurl: {
                      url: row.url,
                      title: row.title,
                      description: row.description,
                      image_url: row.image_url,
                      site_name: row.site_name,
                    },
                  }
                : m,
            );
          });
        },
      )
      .subscribe();

    loadMessages();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(msgUpdateChannel);
      supabase.removeChannel(attachChannel);
      supabase.removeChannel(unfurlChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ---- Fetch the viewer's profile id once (drives message ownership) ----
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("id")
        .eq("uid", user.id)
        .single()
        .then(({ data }) => {
          if (data?.id != null) setSenderProfileId(data.id as number);
        });
    });
  }, []);

  // ---- Presence channel (typing indicator) ----
  useEffect(() => {
    if (!conversationId || senderProfileId === null) return;

    const supabase = createClient();
    const key = String(senderProfileId);
    const ch = supabase.channel(`presence:conversation:${conversationId}`, {
      config: { presence: { key } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ typing: boolean; senderRole: string }>();
      const others = Object.entries(state)
        .filter(([k]) => k !== key)
        .flatMap(([, presences]) => presences);
      setOtherTyping(others.some((p) => p.typing === true));
    });

    ch.on("presence", { event: "join" }, ({ key: joinKey, newPresences }) => {
      if (joinKey === key) return;
      const typingPresences = newPresences as unknown as Array<{
        typing: boolean;
      }>;
      if (typingPresences.some((p) => p.typing)) setOtherTyping(true);
    });

    ch.on("presence", { event: "leave" }, ({ key: leaveKey }) => {
      if (leaveKey === key) return;
      const state = ch.presenceState<{ typing: boolean }>();
      const others = Object.entries(state)
        .filter(([k]) => k !== key)
        .flatMap(([, presences]) => presences);
      setOtherTyping(others.some((p) => p.typing === true));
    });

    ch.subscribe();
    presenceChannelRef.current = ch;

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      isTypingRef.current = false;
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
      presenceChannelRef.current = null;
      setOtherTyping(false);
    };
  }, [conversationId, senderProfileId]);

  // ---- Reads channel ----
  useEffect(() => {
    if (!conversationId || senderProfileId === null) return;

    const supabase = createClient();
    const ch = supabase.channel(`reads:conversation:${conversationId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversation_reads",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as {
          profile_id: number;
          last_read_at: string;
        };
        if (!row?.profile_id) return;
        if (row.profile_id !== senderProfileId) {
          setOtherLastReadAt(new Date(row.last_read_at).getTime());
        }
      },
    );
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, senderProfileId]);

  // Sync messages to cache on change.
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    patchCachedMessages(conversationId, messages);
  }, [messages, conversationId]);

  // Lightbox keyboard navigation.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
      } else if (e.key === "ArrowLeft") {
        setLightbox((lb) => {
          if (!lb || lb.index === 0) return lb;
          return { ...lb, index: lb.index - 1, loadingIndex: true };
        });
      } else if (e.key === "ArrowRight") {
        setLightbox((lb) => {
          if (!lb || lb.index === lb.attachments.length - 1) return lb;
          return { ...lb, index: lb.index + 1, loadingIndex: true };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Sign active lightbox attachment when index changes.
  useEffect(() => {
    if (!lightbox) return;
    const att = lightbox.attachments[lightbox.index];
    if (!att?.path) return;

    if (lightbox.signedUrls.has(att.path)) {
      setLightbox((lb) => (lb ? { ...lb, loadingIndex: false } : lb));
      return;
    }

    setLightbox((lb) => (lb ? { ...lb, loadingIndex: true } : lb));
    const supabase = createClient();
    signWithCache(supabase, [att.path], { expiresIn: 3600 })
      .then((urlMap) => {
        const signed = urlMap.get(att.path!) ?? null;
        if (!signed) {
          setLightbox((lb) => (lb ? { ...lb, loadingIndex: false } : lb));
          return;
        }
        setLightbox((lb) => {
          if (!lb) return lb;
          const next = new Map(lb.signedUrls);
          next.set(att.path!, signed);
          return { ...lb, signedUrls: next, loadingIndex: false };
        });
      })
      .catch(() => {
        setLightbox((lb) => (lb ? { ...lb, loadingIndex: false } : lb));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox?.index, lightbox?.attachments]);

  // ---- Cmd+F search keyboard shortcut ----
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const isMac =
        typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === "f") {
        // Only intercept when focus is inside the thread surface.
        if (
          threadSurfaceRef.current &&
          threadSurfaceRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          setSearchOpen((prev) => {
            if (!prev) {
              requestAnimationFrame(() => searchInputRef.current?.focus());
            }
            return !prev;
          });
        }
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchMatches([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Debounced in-thread search query.
  useEffect(() => {
    if (!searchOpen || !conversationId) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setSearchActiveIdx(0);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at")
        .eq("conversation_id", Number(conversationId))
        .ilike("content", `%${searchQuery}%`)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!aliveRef.current) return;
      const ids = (data ?? []).map((r) => r.id as number);
      setSearchMatches(ids);
      setSearchActiveIdx(0);
    }, 150);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, searchOpen, conversationId]);

  // Scroll to active search match.
  useEffect(() => {
    if (searchMatches.length === 0) return;
    const targetId = searchMatches[searchActiveIdx];
    if (targetId == null) return;
    const idx = messages.findIndex((m) => m.id === targetId);
    if (idx >= 0) {
      virtuosoRef.current?.scrollToIndex({
        index: idx,
        align: "center",
        behavior: "smooth",
      });
    }
  }, [searchActiveIdx, searchMatches, messages]);

  // ---- Pinned messages ----
  const pinnedMessages = useMemo(
    () =>
      messages
        .filter((m) => m.isPinned)
        .sort((a, b) => {
          const bMs = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
          const aMs = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
          return bMs - aMs;
        }),
    [messages],
  );

  const togglePin = useCallback(async (msg: ThreadMessage) => {
    const newPinned = !msg.isPinned;
    const now = new Date().toISOString();

    // Optimistic update.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, isPinned: newPinned, pinnedAt: newPinned ? now : null }
          : m,
      ),
    );

    const supabase = createClient();
    await supabase
      .from("messages")
      .update({
        is_pinned: newPinned,
        pinned_at: newPinned ? now : null,
      })
      .eq("id", msg.id);
  }, []);

  // ---- Edit / Delete ----

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditValue("");
  };

  const persistEdit = async (messageId: number) => {
    const next = editValue.trim();
    if (!next) return;

    const now = new Date().toISOString();
    const previous = messages;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, text: next, editedAt: now } : m,
      ),
    );
    setEditingMessageId(null);
    setEditValue("");

    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .update({ content: next, edited_at: now })
      .eq("id", messageId);

    if (error) {
      setMessages(previous);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    const target = messages.find((m) => m.id === messageId);
    setDeleting(true);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      if (target) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === target.id)) return prev;
          const next = [...prev.filter((m) => m.id !== target.id), target];
          next.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          return next;
        });
      }
      toastError("The message could not be deleted.", "Delete failed");
      setDeleting(false);
      setDeleteTargetId(null);
      return;
    }

    if (target && target.attachments.length > 0) {
      const paths = target.attachments
        .map((a) => a.path)
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        const supabase2 = createClient();
        await supabase2.storage.from("Message Attachments").remove(paths);
      }
    }

    setDeleting(false);
    setDeleteTargetId(null);
    if (!readOnly) {
      textareaRef.current?.focus();
    }
  };

  // ---- Send helpers ----

  async function insertMessageRow(
    supabase: ReturnType<typeof createClient>,
    text: string | null,
    replyToId?: number | null,
  ): Promise<{
    id: number;
    uid: string;
    senderProfileId: number | null;
  } | null> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("uid", user.id)
      .single();

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_uid: user.id,
        sender_profile_id: senderProfile?.id ?? null,
        sender_role: senderRole,
        content: text,
        conversation_id: Number(conversationId),
        ...(replyToId != null ? { reply_to_id: replyToId } : {}),
      })
      .select("id")
      .single();

    if (error || !data?.id) return null;
    return {
      id: data.id,
      uid: user.id,
      senderProfileId: (senderProfile?.id as number | null) ?? null,
    };
  }

  function triggerUnfurl(text: string, messageId: number) {
    if (!/https?:\/\//i.test(text)) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch(`${supabaseUrl}/functions/v1/unfurl-message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message_id: messageId }),
      }).catch(() => {});
    });
  }

  const insertTextMessage = async (
    localId: number,
    text: string,
    replyToId?: number | null,
  ) => {
    if (!conversationId) return;

    const supabase = createClient();
    const result = await insertMessageRow(supabase, text, replyToId);

    if (!result) {
      setMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: "failed" } : m)),
      );
      return;
    }

    // Backfill the viewer's profile id if the mount-time fetch hadn't landed yet,
    // so message ownership is correct without waiting for a reload.
    if (senderProfileId === null && result.senderProfileId !== null) {
      setSenderProfileId(result.senderProfileId);
    }

    setMessages((prev) => {
      const withoutEcho = prev.filter(
        (m) => m.id === localId || m.id !== result.id,
      );
      return withoutEcho.map((m) =>
        m.id === localId
          ? {
              ...m,
              id: result.id,
              status: "sent",
              senderProfileId: result.senderProfileId,
            }
          : m,
      );
    });

    triggerUnfurl(text, result.id);
  };

  async function uploadOneFile(
    supabase: ReturnType<typeof createClient>,
    file: File,
  ): Promise<{ storagePath: string; meta: AttachmentMeta | null } | null> {
    let meta: AttachmentMeta | null = null;
    if (file.type.startsWith("image/")) {
      try {
        const dims = await extractImageMeta(file);
        meta = dims
          ? {
              width: dims.width,
              height: dims.height,
              mimeType: file.type,
              sizeBytes: file.size,
            }
          : { mimeType: file.type, sizeBytes: file.size };
      } catch {
        // ignore
      }
    }

    // Scope the object path by conversation id (first path segment) so the
    // storage INSERT policy can verify the uploader is a participant of that
    // conversation. The same string is persisted to message_attachments.path,
    // keeping the read-side policy (which joins ma.path = objects.name) intact.
    if (!conversationId) return null;
    const storagePath = `${conversationId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from("Message Attachments")
      .upload(storagePath, file, { upsert: false });

    if (error) return null;
    return { storagePath, meta };
  }

  const insertAttachmentsMessage = async (
    localId: number,
    files: PendingAttachment[],
    text: string | null,
    replyToId?: number | null,
  ) => {
    if (!conversationId) return;

    const supabase = createClient();
    const msgResult = await insertMessageRow(supabase, text, replyToId);
    if (!msgResult) {
      setMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: "failed" } : m)),
      );
      return;
    }

    if (senderProfileId === null && msgResult.senderProfileId !== null) {
      setSenderProfileId(msgResult.senderProfileId);
    }

    const realMsgId = msgResult.id;
    const uploadResults = await Promise.all(
      files.map((pa) => uploadOneFile(supabase, pa.file)),
    );

    const anyFailed = uploadResults.some((r) => r === null);
    if (anyFailed) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== localId) return m;
          const updatedAttachments = m.attachments.map((a, idx) => ({
            ...a,
            uploadFailed: uploadResults[idx] === null,
          }));
          return {
            ...m,
            id: realMsgId,
            attachments: updatedAttachments,
            status: "failed" as const,
          };
        }),
      );
      return;
    }

    const attachmentRows = (
      uploadResults as NonNullable<(typeof uploadResults)[number]>[]
    ).map((r, idx) => ({
      message_id: realMsgId,
      path: r.storagePath,
      name: files[idx].name,
      mime_type: files[idx].mimeType || null,
      meta: r.meta,
      sort_index: idx,
    }));

    const { error: attachError } = await supabase
      .from("message_attachments")
      .insert(attachmentRows);

    if (attachError) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === localId ? { ...m, id: realMsgId, status: "failed" } : m,
        ),
      );
      return;
    }

    const paths = (
      uploadResults as NonNullable<(typeof uploadResults)[number]>[]
    ).map((r) => r.storagePath);
    let urlMap = new Map<string, string>();
    try {
      urlMap = await signWithCache(supabase, paths, {
        width: 560,
        quality: 75,
        expiresIn: 3600,
      });
    } catch {
      // Fall back to local preview URLs.
    }

    setMessages((prev) => {
      const withoutEcho = prev.filter(
        (m) => m.id === localId || m.id !== realMsgId,
      );
      return withoutEcho.map((m) => {
        if (m.id !== localId) return m;
        const updatedAttachments = m.attachments.map((a, idx) => {
          const uploaded = (
            uploadResults as NonNullable<(typeof uploadResults)[number]>[]
          )[idx];
          return {
            ...a,
            id: Date.now() + idx,
            path: uploaded.storagePath,
            signedUrl:
              urlMap.get(uploaded.storagePath) ?? a.localPreviewUrl ?? null,
            pendingFile: null,
          };
        });
        return {
          ...m,
          id: realMsgId,
          attachments: updatedAttachments,
          status: "sent" as const,
          senderProfileId: msgResult.senderProfileId,
        };
      });
    });

    if (text) triggerUnfurl(text, realMsgId);
  };

  const handleSubmit = async () => {
    if (readOnly || sending) return;

    const query = input.trim();
    const hasText = query.length > 0;
    const hasFiles = pendingAttachments.length > 0;

    if (!hasText && !hasFiles) return;
    if (!conversationId) return;

    const ch = presenceChannelRef.current;
    if (ch) {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      isTypingRef.current = false;
      ch.track({ typing: false }).catch(() => {});
    }

    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setComposerMultiline(false);

    const replySnapshot = replyingTo;
    setReplyingTo(null);

    const localId = Date.now();

    if (hasFiles) {
      const attachmentsCopy = [...pendingAttachments];
      const optimisticAttachments: Attachment[] = attachmentsCopy.map(
        (pa, i) => ({
          id: -(localId + i),
          path: null,
          name: pa.name,
          mimeType: pa.mimeType,
          meta: null,
          signedUrl: null,
          localPreviewUrl: pa.previewUrl,
          pendingFile: pa.file,
        }),
      );

      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          text: hasText ? query : null,
          senderRole,
          senderProfileId,
          createdAt: new Date().toISOString(),
          replyToId: replySnapshot?.id ?? null,
          attachments: optimisticAttachments,
          status: "sending" as const,
        },
      ]);
      setPendingAttachments([]);
      requestAnimationFrame(() => scrollToBottom());

      await insertAttachmentsMessage(
        localId,
        attachmentsCopy,
        hasText ? query : null,
        replySnapshot?.id ?? null,
      );
      setSending(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });

      if (!hasSentInSession) {
        setHasSentInSession(true);
        if (
          getNotificationPermission() === "default" &&
          typeof sessionStorage !== "undefined" &&
          !sessionStorage.getItem("notif-prompt-dismissed")
        ) {
          setShowPermissionPrompt(true);
        }
      }
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        text: query,
        senderRole,
        createdAt: new Date().toISOString(),
        replyToId: replySnapshot?.id ?? null,
        attachments: [],
        status: "sending" as const,
      },
    ]);
    requestAnimationFrame(() => scrollToBottom());

    await insertTextMessage(localId, query, replySnapshot?.id ?? null);
    setSending(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    if (!hasSentInSession) {
      setHasSentInSession(true);
      if (
        getNotificationPermission() === "default" &&
        typeof sessionStorage !== "undefined" &&
        !sessionStorage.getItem("notif-prompt-dismissed")
      ) {
        setShowPermissionPrompt(true);
      }
    }
  };

  const retryMessage = async (msg: ThreadMessage) => {
    if (msg.status !== "failed") return;

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m)),
    );

    const failedAttachments = msg.attachments.filter(
      (a) => a.uploadFailed && a.pendingFile,
    );
    if (failedAttachments.length > 0) {
      const paPending: PendingAttachment[] = failedAttachments.map((a) => ({
        file: a.pendingFile as File,
        name: a.name,
        mimeType: a.mimeType ?? "",
        previewUrl: a.localPreviewUrl ?? null,
      }));
      await insertAttachmentsMessage(msg.id, paPending, msg.text);
    } else if (msg.attachments.length > 0) {
      const paPending: PendingAttachment[] = msg.attachments
        .filter((a) => a.pendingFile)
        .map((a) => ({
          file: a.pendingFile as File,
          name: a.name,
          mimeType: a.mimeType ?? "",
          previewUrl: a.localPreviewUrl ?? null,
        }));
      if (paPending.length > 0) {
        await insertAttachmentsMessage(msg.id, paPending, msg.text);
      }
    } else if (msg.text) {
      await insertTextMessage(msg.id, msg.text);
    }
  };

  // ---- Keyboard handlers ----

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEditKeyDown = (
    e: KeyboardEvent<HTMLTextAreaElement>,
    messageId: number,
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      persistEdit(messageId);
    }
  };

  // ---- Input change ----

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const ta = e.target;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 200);
    ta.style.height = `${next}px`;
    const hasNewline = val.includes("\n");
    setComposerMultiline(hasNewline || next > 50);

    const ch = presenceChannelRef.current;
    if (ch && senderProfileId !== null) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        ch.track({ typing: true, senderRole, at: Date.now() }).catch(() => {});
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        ch.track({ typing: false }).catch(() => {});
        typingTimerRef.current = null;
      }, 3000);
    }
  };

  // ---- File helpers ----

  const MAX_ATTACHMENTS = 10;

  function addFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    setPendingAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) {
        toastError("Max 10 attachments per message.");
        return prev;
      }
      const toAdd = fileArr.slice(0, remaining);
      if (fileArr.length > remaining) {
        toastError("Max 10 attachments per message.");
      }
      const newPending: PendingAttachment[] = toAdd.map((file) => ({
        file,
        name: file.name,
        mimeType: file.type,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      }));
      return [...prev, ...newPending];
    });
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments((prev) => {
      const pa = prev[idx];
      if (pa?.previewUrl) URL.revokeObjectURL(pa.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ---- Paste handler ----

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const fileItems: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) fileItems.push(file);
      }
    }
    if (fileItems.length > 0) {
      e.preventDefault();
      addFiles(fileItems);
    }
  };

  // ---- Drag and drop ----

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDragActive(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!threadSurfaceRef.current?.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (readOnly) return;
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  // ---- Lightbox opener ----

  const openLightbox = useCallback(
    (clickedAttachment: Attachment) => {
      setHoveredMessageId(null);
      const allImages: Attachment[] = [];
      for (const m of messages) {
        for (const a of m.attachments) {
          if (attachmentKind(a.name, a.mimeType) === "image") {
            allImages.push(a);
          }
        }
      }
      const idx = allImages.findIndex((a) => a.id === clickedAttachment.id);
      const startIndex = idx >= 0 ? idx : 0;
      const signedUrls = new Map<string, string>();
      for (const a of allImages) {
        const url = a.signedUrl ?? a.localPreviewUrl ?? null;
        if (a.path && url) signedUrls.set(a.path, url);
      }
      setLightbox({
        attachments: allImages.length > 0 ? allImages : [clickedAttachment],
        index: startIndex,
        signedUrls,
        loadingIndex: true,
      });
    },
    [messages],
  );

  const hasInput = input.trim().length > 0 || pendingAttachments.length > 0;

  const latestReadMsgId: number | null = (() => {
    if (otherLastReadAt === null) return null;
    let found: number | null = null;
    for (const m of messages) {
      if (
        m.senderProfileId != null &&
        m.senderProfileId === senderProfileId &&
        m.status === "sent" &&
        new Date(m.createdAt).getTime() <= otherLastReadAt
      ) {
        found = m.id;
      }
    }
    return found;
  })();

  // ---- renderMessage (per-row) ----

  const renderMessage = useCallback(
    (msg: ThreadMessage, idx: number) => {
      const isMine =
        msg.senderProfileId != null && msg.senderProfileId === senderProfileId;
      const isEditing = msg.id === editingMessageId;
      const isHovered = msg.id === hoveredMessageId;
      const isHighlighted = msg.id === highlightedMsgId;
      const prev = messages[idx - 1];
      const showDayHeader = shouldShowDayHeader(msg, prev);
      const time = formatMessageTime(msg.createdAt);
      const hasAttachments = msg.attachments.length > 0;
      const showNewDivider =
        newDividerBeforeId.current !== null &&
        msg.id === newDividerBeforeId.current;
      const isGroupStart =
        !prev ||
        prev.senderProfileId !== msg.senderProfileId ||
        showDayHeader ||
        showNewDivider ||
        new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() >
          GROUP_GAP_MS;

      const repliedToMessage = msg.replyToId
        ? (messages.find((m) => m.id === msg.replyToId) ?? null)
        : null;
      const replyDeleted = msg.replyToId != null && !repliedToMessage;

      const showHoverPill =
        isHovered &&
        !isEditing &&
        ((!isGroupStart && !!time) ||
          (msg.status === "sent" && !readOnly) ||
          (isMine && msg.status === "sent" && !readOnly));

      const isActiveMatch = searchMatches[searchActiveIdx] === msg.id;

      return (
        <div
          key={msg.id}
          className={`px-4${idx === 0 ? " pt-4" : ""}`}
          data-msg-id={msg.id}
        >
          {showDayHeader && (
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-sbi-dark-border/30" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark tabular-nums">
                {formatDayHeader(msg.createdAt)}
              </span>
              <div className="h-px flex-1 bg-sbi-dark-border/30" />
            </div>
          )}
          {showNewDivider && (
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-sbi-green/30" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-sbi-green">
                New
              </span>
              <div className="h-px flex-1 bg-sbi-green/30" />
            </div>
          )}
          <div
            className={`relative flex items-end gap-2 pb-1 ${
              isGroupStart ? "pt-5" : "pt-0.5"
            } ${isMine ? "justify-end" : "justify-start"}`}
            onMouseEnter={() => setHoveredMessageId(msg.id)}
            onMouseLeave={() =>
              setHoveredMessageId((current) =>
                current === msg.id ? null : current,
              )
            }
          >
            <div
              className={`flex flex-col gap-1 max-w-[75%] ${
                isMine ? "items-end" : "items-start"
              }`}
            >
              {isGroupStart && time && (
                <span className="text-[10px] tabular-nums text-sbi-muted-dark px-1">
                  {time}
                  {msg.editedAt && (
                    <span className="ml-1 text-[10px] tabular-nums text-sbi-muted-dark">
                      · edited
                    </span>
                  )}
                </span>
              )}

              <div
                className={`relative flex flex-col gap-1 w-fit ${
                  isMine ? "items-end" : "items-start"
                } transition-all duration-700 ${
                  isHighlighted
                    ? "bg-sbi-green/15 rounded-xl shadow-[0_0_32px_-8px_rgba(34,197,94,0.4)]"
                    : ""
                } ${
                  isActiveMatch
                    ? "shadow-[0_0_24px_-4px_rgba(34,197,94,0.35)] rounded-2xl"
                    : ""
                }`}
              >
                {/* Hover pill */}
                {showHoverPill && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 ${
                      isMine ? "right-full mr-2" : "left-full ml-2"
                    }`}
                  >
                    {!isGroupStart && time && (
                      <span className="text-[10px] tabular-nums text-sbi-muted-dark whitespace-nowrap pointer-events-none">
                        {time}
                        {msg.editedAt && <span className="ml-1">· edited</span>}
                      </span>
                    )}
                    {msg.status === "sent" && !readOnly && (
                      <div className="flex items-center gap-0.5 rounded-md border border-sbi-dark-border/70 bg-sbi-dark-card p-0.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]">
                        {isMine && msg.text && (
                          <button
                            type="button"
                            aria-label="Edit message"
                            title="Edit"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditValue(msg.text ?? "");
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-sbi-muted hover:text-sbi-green hover:bg-sbi-green/10 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        )}
                        {isMine && (
                          <button
                            type="button"
                            aria-label="Delete message"
                            title="Delete"
                            onClick={() => {
                              setDeleteTargetId(msg.id);
                              setHoveredMessageId(null);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Reply to message"
                          title="Reply"
                          onClick={() => {
                            setReplyingTo(msg);
                            textareaRef.current?.focus();
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded text-sbi-muted hover:text-sbi-green transition-colors cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label={
                            msg.isPinned ? "Unpin message" : "Pin message"
                          }
                          title={msg.isPinned ? "Unpin" : "Pin"}
                          onClick={() => togglePin(msg)}
                          className={`flex h-6 w-6 items-center justify-center rounded transition-colors cursor-pointer ${
                            msg.isPinned
                              ? "text-sbi-green hover:text-sbi-muted"
                              : "text-sbi-muted hover:text-sbi-green"
                          }`}
                        >
                          {msg.isPinned ? (
                            <PinOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                          ) : (
                            <Pin className="w-3.5 h-3.5" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Quoted reply preview */}
                {(repliedToMessage || replyDeleted) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (repliedToMessage) jumpToMessage(repliedToMessage.id);
                    }}
                    disabled={replyDeleted}
                    className="inline-flex max-w-full items-center gap-2 px-2.5 py-1 rounded-md border border-sbi-dark-border/60 bg-sbi-dark-card/60 hover:bg-sbi-dark-card transition-colors cursor-pointer mb-1 disabled:cursor-default"
                  >
                    <div className="w-0.5 h-4 bg-sbi-green/60 shrink-0 rounded-full" />
                    <span className="text-[10px] text-sbi-muted-dark font-medium shrink-0">
                      {replyDeleted
                        ? ""
                        : repliedToMessage?.senderProfileId === senderProfileId
                          ? "You:"
                          : "Them:"}
                    </span>
                    <span className="text-[10px] text-sbi-muted whitespace-pre-wrap line-clamp-2">
                      {replyDeleted
                        ? "(message deleted)"
                        : repliedToMessage?.text || "(attachment)"}
                    </span>
                  </button>
                )}

                {/* Text bubble or edit box */}
                {isEditing ? (
                  <div className="flex w-[min(560px,70vw)] min-w-[340px] flex-col overflow-hidden rounded-xl border border-sbi-green/40 bg-sbi-dark-card">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                      rows={5}
                      // biome-ignore lint/a11y/noAutofocus: inline edit needs immediate focus
                      autoFocus
                      className="min-h-[140px] w-full resize-none bg-transparent px-4 py-3 text-sm text-white leading-relaxed focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-sbi-dark-border/50 px-2.5 py-1.5">
                      <span className="text-[10px] text-sbi-muted-dark">
                        Enter to save, Esc to cancel
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex h-7 items-center justify-center rounded-md px-3 text-[11px] uppercase tracking-[0.04em] text-sbi-muted cursor-pointer hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => persistEdit(msg.id)}
                          disabled={editValue.trim().length === 0}
                          className={cn(btnPrimary, "h-7 px-3 text-[11px]")}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  msg.text && (
                    <div
                      className={`inline-block rounded-2xl border px-3.5 py-2 text-sm leading-snug whitespace-pre-wrap break-words bg-sbi-dark-card border-sbi-dark-border/60 text-white ${
                        msg.status === "sending" ? "opacity-70" : ""
                      }`}
                    >
                      {renderMarkdown(msg.text, {
                        highlight: searchQuery.trim() || undefined,
                        highlightActive: isActiveMatch,
                      })}
                    </div>
                  )
                )}

                {/* Unfurl card */}
                {msg.unfurl && <UnfurlCard unfurl={msg.unfurl} />}

                {/* Attachments */}
                {hasAttachments && (
                  <div className={msg.status === "sending" ? "opacity-70" : ""}>
                    <AttachmentBubbles
                      attachments={msg.attachments}
                      onOpenLightbox={openLightbox}
                    />
                  </div>
                )}
              </div>

              {/* Status row */}
              {isMine && (
                <div className="flex items-center gap-2 px-1">
                  {msg.status === "sending" && (
                    <span className="text-[10px] text-sbi-muted-dark">
                      Sending
                    </span>
                  )}
                  {msg.status === "failed" && (
                    <span className="flex items-center gap-1.5 text-[10px] text-red-400">
                      Failed
                      <button
                        type="button"
                        onClick={() => retryMessage(msg)}
                        className="inline-flex items-center gap-1 text-sbi-green hover:underline cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" strokeWidth={2} />
                        Retry
                      </button>
                    </span>
                  )}
                  {msg.status === "sent" && latestReadMsgId === msg.id && (
                    <span className="text-[10px] text-sbi-green/80">
                      Read ·{" "}
                      {new Date(otherLastReadAt!).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      senderRole,
      editingMessageId,
      hoveredMessageId,
      highlightedMsgId,
      messages,
      readOnly,
      searchMatches,
      searchActiveIdx,
      searchQuery,
      latestReadMsgId,
      otherLastReadAt,
      editValue,
      jumpToMessage,
      openLightbox,
      togglePin,
    ],
  );

  return (
    <div
      ref={threadSurfaceRef}
      className="absolute inset-0 flex flex-col animate-thread-fade-in"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Pinned strip */}
      <PinnedStrip pinnedMessages={pinnedMessages} onJump={jumpToMessage} />

      {/* In-thread search bar */}
      {searchOpen && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-sbi-dark-border/30 bg-sbi-dark/95 backdrop-blur z-10">
          <Search
            className="w-3.5 h-3.5 text-sbi-muted-dark shrink-0"
            strokeWidth={1.75}
          />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                setSearchQuery("");
                setSearchMatches([]);
              } else if (e.key === "Enter") {
                setSearchActiveIdx(
                  (i) => (i + 1) % Math.max(1, searchMatches.length),
                );
              }
            }}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-sbi-muted-dark focus:outline-none"
          />
          {searchMatches.length > 0 && (
            <span className="text-[11px] tabular-nums text-sbi-muted-dark shrink-0">
              {searchActiveIdx + 1} of {searchMatches.length}
            </span>
          )}
          <button
            type="button"
            aria-label="Previous match"
            disabled={searchMatches.length === 0}
            onClick={() =>
              setSearchActiveIdx((i) =>
                i > 0 ? i - 1 : searchMatches.length - 1,
              )
            }
            className="flex h-6 w-6 items-center justify-center rounded text-sbi-muted hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Next match"
            disabled={searchMatches.length === 0}
            onClick={() =>
              setSearchActiveIdx(
                (i) => (i + 1) % Math.max(1, searchMatches.length),
              )
            }
            className="flex h-6 w-6 items-center justify-center rounded text-sbi-muted hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
              setSearchMatches([]);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-sbi-muted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Thread scroll area */}
      <div className="relative flex-1 min-h-0">
        {/* Drag-and-drop overlay */}
        {dragActive && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-sbi-dark/80 border-2 border-dashed border-sbi-green/40 rounded-md pointer-events-none">
            <span className="text-sm text-sbi-green font-medium">
              Drop to attach
            </span>
          </div>
        )}

        {loadError ? (
          <div className="flex h-full items-center justify-center p-4">
            <EmptyState
              title="Messages didn't load"
              description="Something went wrong fetching this conversation."
              action={
                <button
                  type="button"
                  onClick={loadMessages}
                  className={cn(btnPrimary, "px-4 h-9")}
                >
                  <RotateCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Try again
                </button>
              }
            />
          </div>
        ) : loading ? (
          <div className="h-full" />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <EmptyState
              title="No messages yet"
              description={
                readOnly
                  ? "This conversation has no messages."
                  : "Send the first message below."
              }
            />
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={messages.length - 1}
            data={messages}
            itemContent={(absoluteIndex, msg) => {
              const localIdx = absoluteIndex - firstItemIndex;
              return renderMessage(msg, localIdx);
            }}
            followOutput="smooth"
            startReached={() => {
              void loadOlder();
            }}
            atBottomStateChange={(bottom) => {
              setAtBottom(bottom);
              if (bottom) setHasNew(false);
            }}
            className="h-full custom-scrollbar"
            style={{ height: "100%" }}
            overscan={200}
            components={{
              Header: () =>
                loadingOlder ? (
                  <div className="flex justify-center py-3">
                    <RotateCw
                      className="w-4 h-4 text-sbi-muted animate-spin"
                      strokeWidth={1.75}
                    />
                  </div>
                ) : noMoreOlder.current ? null : null,
            }}
          />
        )}
      </div>

      {/* New-messages indicator */}
      {hasNew && !atBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center z-20">
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="pointer-events-auto inline-flex items-center gap-2 px-3.5 h-8 text-xs text-sbi-green bg-sbi-dark-card border border-sbi-green/30 rounded-full cursor-pointer hover:bg-sbi-green hover:text-sbi-dark transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
            New messages
          </button>
        </div>
      )}

      {/* Typing indicator */}
      {otherTyping && (
        <div className="shrink-0 px-4 py-1 text-[11px] text-sbi-muted-dark italic">
          {senderRole === "director" ? "Client" : "Director"} is typing…
        </div>
      )}

      {/* Composer */}
      {!readOnly && (
        <div className="shrink-0 border-t border-sbi-dark-border/30 p-4 flex flex-col gap-2 bg-sbi-dark">
          {/* Notification permission prompt */}
          {showPermissionPrompt && (
            <div className="order-0">
              <PermissionPrompt
                onEnable={async () => {
                  const result = await requestNotificationPermission();
                  setShowPermissionPrompt(false);
                  if (result === "denied") {
                    sessionStorage.setItem("notif-prompt-dismissed", "1");
                  }
                }}
                onDismiss={() => {
                  setShowPermissionPrompt(false);
                  sessionStorage.setItem("notif-prompt-dismissed", "1");
                }}
              />
            </div>
          )}

          {/* Reply chip */}
          {replyingTo && (
            <div className="order-1 flex items-start gap-2 px-3 py-2 rounded-lg border border-sbi-green/30 bg-sbi-green/5 w-full">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.04em] text-sbi-green font-medium mb-0.5">
                  Replying to{" "}
                  {replyingTo.senderProfileId === senderProfileId
                    ? "yourself"
                    : "the other party"}
                </div>
                <div className="text-[10px] text-sbi-muted whitespace-pre-wrap line-clamp-2">
                  {replyingTo.text || "(attachment)"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
                className="flex h-7 w-7 items-center justify-center rounded-md text-sbi-muted hover:text-white hover:bg-sbi-dark/40 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          )}

          {/* Pending attachment chips */}
          {pendingAttachments.length > 0 && (
            <div className="order-2 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {pendingAttachments.map((pa, idx) => (
                <div
                  key={`${pa.name}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sbi-dark-border/60 bg-sbi-dark-card shrink-0"
                >
                  {pa.previewUrl ? (
                    <img
                      src={pa.previewUrl}
                      alt={pa.name}
                      className="h-8 w-8 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-sbi-dark shrink-0">
                      {pa.mimeType === "application/pdf" ? (
                        <FileText
                          className="w-4 h-4 text-sbi-muted"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <FileIcon
                          className="w-4 h-4 text-sbi-muted"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                  )}
                  <span className="text-xs text-white truncate max-w-[120px]">
                    {pa.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(idx)}
                    className="text-sbi-muted hover:text-red-400 transition-colors cursor-pointer shrink-0"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={`order-1 flex gap-1 rounded-2xl border border-sbi-dark-border/60 bg-sbi-dark-card px-2 py-1.5 transition-colors focus-within:border-sbi-green/50 ${
              composerMultiline ? "items-start" : "items-center"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,video/*,audio/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sbi-muted hover:text-sbi-green transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Add file"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message"
              rows={1}
              className="flex-1 box-border min-h-9 max-h-[200px] resize-none bg-transparent px-1 py-2 text-sm text-white leading-5 focus:outline-none placeholder:text-sbi-muted-dark [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasInput || sending}
              aria-label="Send message"
              className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                hasInput && !sending
                  ? "text-sbi-green hover:bg-sbi-green hover:text-sbi-dark cursor-pointer"
                  : "text-sbi-muted-dark cursor-not-allowed"
              }`}
            >
              <SendHorizontal className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        opened={deleteTargetId !== null}
        onClose={() => {
          if (!deleting) setDeleteTargetId(null);
        }}
        title="Delete message"
        description="This message will be permanently removed from the conversation. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          if (deleteTargetId !== null) {
            await handleDeleteMessage(deleteTargetId);
          }
        }}
      />

      {/* Lightbox carousel */}
      {lightbox &&
        (() => {
          const att = lightbox.attachments[lightbox.index];
          const displayUrl = att?.path
            ? (lightbox.signedUrls.get(att.path) ??
              att.signedUrl ??
              att.localPreviewUrl ??
              null)
            : (att?.signedUrl ?? att?.localPreviewUrl ?? null);
          const total = lightbox.attachments.length;
          const canPrev = lightbox.index > 0;
          const canNext = lightbox.index < total - 1;

          return (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-sbi-dark/90 p-6"
              onClick={() => setLightbox(null)}
              role="presentation"
            >
              {lightbox.loadingIndex && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <RotateCw
                    className="w-6 h-6 text-sbi-muted animate-spin"
                    strokeWidth={1.75}
                  />
                </div>
              )}

              <button
                type="button"
                aria-label="Previous image"
                disabled={!canPrev}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canPrev)
                    setLightbox((lb) =>
                      lb
                        ? { ...lb, index: lb.index - 1, loadingIndex: true }
                        : lb,
                    );
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-sbi-muted hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                aria-label="Next image"
                disabled={!canNext}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canNext)
                    setLightbox((lb) =>
                      lb
                        ? { ...lb, index: lb.index + 1, loadingIndex: true }
                        : lb,
                    );
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-sbi-muted hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-6 h-6" strokeWidth={1.75} />
              </button>

              {displayUrl && (
                <img
                  src={displayUrl}
                  alt={att?.name ?? "Image preview"}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)]"
                />
              )}

              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                {total > 1 && (
                  <span className="text-xs text-sbi-muted-dark tabular-nums">
                    {lightbox.index + 1} of {total}
                  </span>
                )}
                {displayUrl && (
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sbi-muted hover:text-sbi-green transition-colors"
                  >
                    Open original
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox(null);
                }}
                aria-label="Close preview"
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-sbi-muted hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
          );
        })()}
    </div>
  );
}
