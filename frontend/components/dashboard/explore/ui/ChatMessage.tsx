"use client";

import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import gsap from "gsap";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Pencil,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import {
  Children,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Components, Streamdown } from "streamdown";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAttachmentContent, type SourceDocument } from "@/lib/api/chat";
import { saveTextToKnowledge } from "@/lib/api/knowledge";
import type { DisplayMessage, TimelineStep } from "@/lib/chat/chat-context";
import { useChat } from "@/lib/chat/chat-context";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { getFileInfo } from "./file-info";
import { ImageAttachmentGallery, isImageAttachment } from "./image-preview";
import { ProcessTimeline } from "./ProcessTimeline";

// Single-dollar inline math ON (the default is $$-only): the model is
// prompted to write inline math as $…$ and to escape currency as \$, and
// remark-math's whitespace rules reject most accidental currency pairs anyway.
const math = createMathPlugin({ singleDollarTextMath: true });

interface ChatMessageProps {
  message: DisplayMessage;
  isLatestAssistant?: boolean;
}

// Inline citation chip: numeric badge with hover-card preview. Clicking opens
// the source viewer slide-over with the retrieved passage (the exact text the
// answer was grounded in — already persisted on the message's sources), so
// answers are auditable without leaving the chat.
function CitationChip({
  index,
  source,
}: {
  index: number;
  source: SourceDocument;
}) {
  const [open, setOpen] = useState(false);
  const filename = source.filename;
  const preview = (source.content || "").slice(0, 220).trim();
  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center align-middle mx-0.5 h-[1.125rem] min-w-[1.125rem] px-1 rounded-full text-[10px] font-semibold tabular-nums text-sbi-green/90 bg-sbi-green/10 ring-1 ring-inset ring-sbi-green/30 hover:bg-sbi-green/25 hover:ring-sbi-green/60 hover:text-sbi-green transition-all"
              aria-label={`Source ${index}: ${filename}`}
            >
              {index}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs text-xs leading-relaxed bg-sbi-dark-card border-sbi-dark-border"
          >
            <div className="text-white font-medium mb-1">
              {filename}
              {source.page_number ? ` (p. ${source.page_number})` : ""}
            </div>
            {preview && (
              <div className="text-sbi-muted line-clamp-4">{preview}</div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SourceViewerSheet
        open={open}
        onOpenChange={setOpen}
        index={index}
        source={source}
      />
    </>
  );
}

// Slide-over showing the full retrieved passage behind a citation. Radix
// mounts the sheet content only while open, so one per chip costs nothing
// at rest.
function SourceViewerSheet({
  open,
  onOpenChange,
  index,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  source: SourceDocument;
}) {
  const filename = source.filename;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-sbi-dark border-sbi-dark-border text-white flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-sbi-dark-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-white text-sm font-medium">
            <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-md border border-sbi-green/30 bg-sbi-green/10 px-1 text-[11px] font-medium text-sbi-green/90">
              {index}
            </span>
            <span className="truncate">{filename}</span>
          </SheetTitle>
          <SheetDescription className="text-xs text-sbi-muted">
            {source.page_number ? `Page ${source.page_number} · ` : ""}
            Passage retrieved from your project documents — the answer's [
            {index}] citations are grounded in this text.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar px-5 py-4">
          <p className="whitespace-pre-wrap break-words text-[13px] font-light leading-relaxed text-white/85">
            {source.content || "The passage text is not available."}
          </p>
        </div>
        <div className="border-t border-sbi-dark-border px-5 py-3">
          <Link
            href={`/dashboard/files?file=${encodeURIComponent(filename)}`}
            className="text-xs font-medium text-sbi-green/90 hover:text-sbi-green transition-colors"
          >
            Open in Files →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Attachment chip on a sent message. Chat attachments are session-scoped;
// directors get a one-click bridge into the shared, searchable project
// knowledge base (the backend indexes it as source='chat').
function MessageAttachmentChip({
  attachment,
}: {
  attachment: {
    filename: string;
    hash?: string;
    content?: string;
    file_type?: string;
  };
}) {
  const { user, activeProject } = useProject();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const fileInfo = getFileInfo(attachment.filename);
  const projectId = activeProject?.projectId ?? null;
  // Images are stored as a base64 data URL (for the multimodal models), not as
  // meaningful text — saving one to project knowledge would pollute the RAG
  // corpus with a base64 blob, so the save action is disabled for images.
  const canSave =
    user?.role === "director" &&
    projectId !== null &&
    attachment.file_type !== "image" &&
    Boolean(attachment.hash || attachment.content);

  // A saved attachment stays saved across reloads: the corpus stamps the same
  // SHA-256 (both sides hash the extracted text), so a hash hit in
  // client_knowledge means this exact content is already indexed. Members can
  // read their project's rows under RLS, so this is a cheap existence check.
  useEffect(() => {
    if (!canSave || !attachment.hash || projectId === null) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("client_knowledge")
      .select("id")
      .eq("project_id", projectId)
      .eq("metadata->>content_hash", attachment.hash)
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setState("saved");
      });
    return () => {
      cancelled = true;
    };
  }, [canSave, attachment.hash, projectId]);

  const handleSave = async () => {
    if (!canSave || state !== "idle" || projectId === null) return;
    setState("saving");
    try {
      const content =
        attachment.content ??
        (attachment.hash
          ? (await getAttachmentContent(attachment.hash))?.content
          : undefined);
      if (!content) {
        throw new Error("The attachment's text is no longer available.");
      }
      const res = await saveTextToKnowledge(
        projectId,
        attachment.filename,
        content,
      );
      setState("saved");
      toastSuccess(
        res.duplicate
          ? `"${attachment.filename}" is already in the project knowledge.`
          : `"${attachment.filename}" saved — the assistant can now search it for the whole team.`,
        "Project knowledge",
      );
    } catch (err) {
      setState("idle");
      toastError(
        err instanceof Error ? err.message : "Couldn't save the attachment.",
        "Save failed",
      );
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-sbi-dark-card/80 border border-sbi-dark-border rounded-xl">
      {fileInfo.icon}
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-white font-light truncate max-w-40">
          {attachment.filename.replace(/\.[^/.]+$/, "")}
        </span>
        <span className={`text-xs ${fileInfo.color}`}>{fileInfo.label}</span>
      </div>
      {canSave && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleSave}
                disabled={state !== "idle"}
                aria-label={
                  state === "saved"
                    ? "Saved to project knowledge"
                    : "Save to project knowledge"
                }
                className="ml-1 shrink-0 rounded-md p-1 text-sbi-muted hover:text-sbi-green hover:bg-sbi-green/10 transition-colors disabled:hover:bg-transparent"
              >
                {state === "saving" ? (
                  <span className="block size-3.5 animate-spin rounded-full border border-sbi-green/40 border-t-sbi-green/90" />
                ) : state === "saved" ? (
                  <Check
                    className="size-3.5 text-sbi-green"
                    strokeWidth={1.5}
                  />
                ) : (
                  <BookmarkPlus className="size-3.5" strokeWidth={1.5} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-56 text-xs leading-relaxed bg-sbi-dark-card border border-sbi-dark-border"
            >
              {state === "saved" ? (
                <div className="text-white">Saved to project knowledge</div>
              ) : (
                <>
                  <div className="text-white font-medium mb-1">
                    Save to project knowledge
                  </div>
                  <div className="text-sbi-muted">
                    Lets the assistant search this file for the whole team.
                  </div>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// Replace bracketed numeric markers in a string with CitationChip elements.
// Out-of-range indices stay as plain text.
// Exported for unit testing; not part of the public API.
export function interpolateCitations(
  text: string,
  sources: SourceDocument[],
): ReactNode {
  if (sources.length === 0 || !text.includes("[")) return text;
  const parts: ReactNode[] = [];
  const pattern = /\[(\d+)\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  let matched = false;
  match = pattern.exec(text);
  while (match !== null) {
    const n = Number.parseInt(match[1], 10);
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (n < 1 || n > sources.length) {
      // Out-of-range marker: keep the literal "[n]" and advance past it, so the
      // text between it and the next valid citation isn't dropped or duplicated.
      parts.push(match[0]);
    } else {
      parts.push(
        <CitationChip
          key={`cite-${match.index}-${key++}`}
          index={n}
          source={sources[n - 1]}
        />,
      );
      matched = true;
    }
    lastIdx = pattern.lastIndex;
    match = pattern.exec(text);
  }
  if (!matched) return text; // nothing replaced — hand back the original string
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

// Walks immediate string children and runs them through interpolateCitations.
// Nested elements (e.g. <strong> inside <p>) hit their own override at their own level.
function processCitations(
  children: ReactNode,
  sources: SourceDocument[],
): ReactNode {
  if (sources.length === 0) return children;
  return Children.map(children, (child) => {
    if (typeof child === "string") return interpolateCitations(child, sources);
    return child;
  });
}

// Build the Streamdown component map for an assistant message, capturing its sources.
// NOTE: Streamdown's wrapper adds space-y-4 (1rem between siblings). Do NOT add
// vertical margins (mb-*, mt-*, my-*) to these overrides — they would double up.
function buildMarkdownComponents(sources: SourceDocument[]): Components {
  return {
    p: ({ children }) => (
      <p className="leading-relaxed">{processCitations(children, sources)}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-outside space-y-1 pl-5 text-sbi-muted marker:text-sbi-muted">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside space-y-1 pl-5 text-sbi-muted marker:text-sbi-muted">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed [&>p]:inline">
        {processCitations(children, sources)}
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-white">
        {processCitations(children, sources)}
      </strong>
    ),
    em: ({ children }) => (
      <em className="text-sbi-muted italic">
        {processCitations(children, sources)}
      </em>
    ),
    a: ({ href, children }) => {
      // Answers (and the RAG documents feeding them) are model-authored, so only
      // render http(s)/mailto links as clickable — never javascript:/data: etc.
      // Unsafe schemes degrade to plain text rather than an executable link.
      const safe = /^(https?:|mailto:)/i.test((href ?? "").trim());
      if (!safe) return <span className="text-sbi-green">{children}</span>;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sbi-green hover:underline"
        >
          {children}
        </a>
      );
    },
    img: ({ alt }) => {
      // Model/RAG-authored images are an uncontrolled egress channel: a single
      // `![](http://tracker…)` in a response would auto-fetch without user intent.
      // Unlike `a` (which requires a click), images load immediately, so even an
      // https src is a silent tracking vector. Render a non-loading placeholder that
      // preserves the alt text without making any outbound request.
      return (
        <span className="inline-flex items-center gap-1 rounded border border-sbi-dark-border px-2 py-0.5 text-xs text-sbi-muted">
          [image{alt ? `: ${alt}` : ""}]
        </span>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-sbi-green/40 pl-4 italic text-sbi-muted">
        {processCitations(children, sources)}
      </blockquote>
    ),
    h1: ({ children }) => (
      <h1 className="text-xl font-semibold text-white">
        {processCitations(children, sources)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold text-white">
        {processCitations(children, sources)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-white">
        {processCitations(children, sources)}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-white">
        {processCitations(children, sources)}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-semibold text-white">
        {processCitations(children, sources)}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-semibold text-sbi-muted">
        {processCitations(children, sources)}
      </h6>
    ),
    del: ({ children }) => (
      <del className="line-through text-sbi-muted/60">{children}</del>
    ),
    hr: () => <hr className="border-sbi-dark-border" />,
    table: ({ children }) => (
      <div className="overflow-x-auto rounded-lg border border-sbi-dark-border">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-sbi-dark-card/80">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tfoot: ({ children }) => <tfoot>{children}</tfoot>,
    tr: ({ children }) => (
      <tr className="border-b border-sbi-dark-border/50 last:border-b-0 hover:bg-sbi-dark-card/30 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider border-b border-sbi-dark-border">
        {processCitations(children, sources)}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-sm text-sbi-muted">
        {processCitations(children, sources)}
      </td>
    ),
    input: ({ checked }) => (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-2 accent-sbi-green"
      />
    ),
  };
}

// Component map for messages with no sources — the common case (every turn while
// it streams, and any answer that cited nothing). Built once so streaming deltas
// don't re-allocate the full set of component lambdas on every token.
const EMPTY_SOURCE_COMPONENTS = buildMarkdownComponents([]);

// ‹ i/n › control for stepping between sibling branches of a message (created by
// editing a prompt or regenerating an answer). Arrows disable at the ends.
function BranchPicker({
  index,
  count,
  disabled,
  onPrev,
  onNext,
}: {
  index: number;
  count: number;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 text-xs text-sbi-muted select-none">
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled || index <= 1}
        aria-label="Previous version"
        className="p-0.5 rounded hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
      <span className="tabular-nums font-medium px-0.5">
        {index}/{count}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || index >= count}
        aria-label="Next version"
        className="p-0.5 rounded hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export function ChatMessage({
  message,
  isLatestAssistant = false,
}: ChatMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const {
    editAndResend,
    isLoading,
    isStreaming,
    loadingPhase,
    regenerateResponse,
    switchBranch,
  } = useChat();

  // Inline status shown inside the latest streaming message whenever the model
  // is working but NOT emitting answer text — a tool pause, the post-tool gap
  // before the first answer token, or pre-content thinking. `isLoading` is the
  // right signal: every answer token sets loadingPhase to "complete" (so
  // isLoading is false while text actively streams) and any working phase
  // raises it again, so this is true exactly during the "frozen cursor" gaps.
  const streamStatusLabel =
    isLatestAssistant && message.isStreaming && isLoading
      ? loadingPhase === "searching"
        ? "Searching documents"
        : loadingPhase === "generating"
          ? "Writing response"
          : "Thinking"
      : undefined;

  // Show the ‹ i/n › picker when this message is one of several sibling branches
  // and is backed by a persisted row (dbId) we can switch on.
  const branchCount = message.branchCount ?? 0;
  const hasBranches = branchCount > 1 && message.dbId != null;
  const branchPicker = hasBranches ? (
    <BranchPicker
      index={message.branchIndex ?? 1}
      count={branchCount}
      disabled={isLoading || isStreaming}
      onPrev={() => message.dbId != null && switchBranch(message.dbId, -1)}
      onNext={() => message.dbId != null && switchBranch(message.dbId, 1)}
    />
  ) : null;

  // Reuse the shared empty-sources map when this message cites nothing, so the
  // memo doesn't rebuild every render (message.sources ?? [] is a fresh array
  // each time). Only build a per-message map when real sources exist.
  const markdownComponents = useMemo(
    () =>
      message.sources?.length
        ? buildMarkdownComponents(message.sources)
        : EMPTY_SOURCE_COMPONENTS,
    [message.sources],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power2.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Check if user messages overflows. Re-measure whenever the rendered text
  // changes; `content` is referenced so the measurement reflects the latest
  // message body (it is what drives the DOM height read below).
  const content = message.content;
  useEffect(() => {
    // `content` is read so the effect re-runs and re-measures the rendered DOM
    // height whenever the message body changes (e.g. while streaming).
    void content;
    if (contentRef.current && isUser && !isEditing) {
      const lineHeight = 24;
      const maxLines = 5;
      const maxHeight = lineHeight * maxLines;
      setIsOverflowing(contentRef.current.scrollHeight > maxHeight);
    }
  }, [content, isUser, isEditing]);

  // Auto-resize
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const displayContent = message.content;

  // Process timeline (reasoning interleaved with tool calls), shown ABOVE the
  // answer. Falls back to a single reasoning step for a turn that streamed
  // reasoning but no steps (defensive — live turns populate `steps`). Both live
  // and reloaded turns populate this: the API route persists `reasoning` +
  // `process_steps`, and buildActiveBranch re-derives `steps`/`reasoning` from
  // them, so a reloaded turn renders the same timeline it streamed.
  const timelineSteps: TimelineStep[] =
    message.steps && message.steps.length > 0
      ? message.steps
      : message.reasoning?.trim()
        ? [{ kind: "reasoning", text: message.reasoning.trim() }]
        : [];
  const hasTimeline = !isUser && timelineSteps.length > 0;
  // The timeline is "done" once answer text exists or the turn stops streaming.
  const timelineDone = displayContent.trim().length > 0 || !message.isStreaming;

  // Truncated content for collapsed view
  const getTruncatedContent = () => {
    const lines = displayContent.split("\n");
    if (lines.length > 5) {
      return `${lines.slice(0, 5).join("\n")}...`;
    }
    if (displayContent.length > 300 && !displayContent.includes("\n")) {
      return `${displayContent.slice(0, 300)}...`;
    }
    return displayContent;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    setEditedContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleSubmitEdit = async () => {
    if (
      editedContent.trim() &&
      editedContent !== message.content &&
      !isLoading
    ) {
      setIsEditing(false);
      await editAndResend(message.id, editedContent.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Get attachments for this message
  const messageAttachments =
    isUser && message.attachments ? message.attachments : [];

  // User message
  if (isUser) {
    return (
      <div ref={containerRef} className="group flex justify-end">
        {/* Content column, right aligned, set width. While editing it takes
            the full row so the textarea gets real horizontal room. */}
        <div
          className={`flex flex-col items-end gap-2 overflow-hidden ${
            isEditing ? "w-full" : "max-w-[80%]"
          }`}
        >
          {/* Attached files, horizontal row, right-aligned */}
          {messageAttachments.length > 0 && !isEditing && (
            <div className="flex flex-row flex-wrap justify-end gap-2">
              <ImageAttachmentGallery
                attachments={messageAttachments.filter(isImageAttachment)}
                thumbClassName="h-32 w-32 max-w-[60vw]"
              />
              {messageAttachments
                .filter((a) => !isImageAttachment(a))
                .map((attachment) => (
                  <MessageAttachmentChip
                    key={attachment.filename}
                    attachment={attachment}
                  />
                ))}
            </div>
          )}

          {/* Message row - on hover icons and msg bubble */}
          <div className="flex items-start gap-2 min-w-0 w-full justify-end">
            {/* Action buttons - left of msg bubble, aligned top */}
            <div
              className={`flex items-center gap-1 shrink-0 pt-2 transition-opacity duration-200 ${
                isEditing
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100"
              }`}
            >
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy message"
                className="p-1.5 text-sbi-muted hover:text-white hover:bg-sbi-dark-card rounded-lg transition-colors"
                title="Copy"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-sbi-green" />
                ) : (
                  <Copy className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
              <button
                type="button"
                onClick={handleEdit}
                aria-label="Edit message"
                className="p-1.5 text-sbi-muted hover:text-white hover:bg-sbi-dark-card rounded-lg transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Message bubble */}
            <div
              className={`min-w-0 bg-sbi-dark-card/80 border border-sbi-green/20 rounded-2xl overflow-hidden relative ${
                isEditing ? "flex-1" : ""
              }`}
            >
              {/* Expand/Collapse button */}
              {isOverflowing && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={
                    isExpanded ? "Collapse message" : "Expand message"
                  }
                  className="absolute top-2 right-2 p-1 text-sbi-muted hover:text-white hover:bg-sbi-dark rounded-lg transition-colors z-10"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              )}

              {isEditing ? (
                <div className="p-3 space-y-2">
                  <textarea
                    ref={textareaRef}
                    value={editedContent}
                    onChange={(e) => {
                      setEditedContent(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-sbi-dark border border-sbi-green/30 rounded-xl px-3 py-2 text-white font-light text-sm leading-relaxed resize-none focus:outline-none focus:border-sbi-green/50"
                    rows={1}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2 py-1 text-xs text-sbi-muted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitEdit}
                      disabled={
                        !editedContent.trim() ||
                        editedContent === message.content ||
                        isLoading
                      }
                      className="px-2 py-1 text-xs bg-sbi-green/20 text-sbi-green border border-sbi-green/30 rounded-lg hover:bg-sbi-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`p-3 ${isOverflowing ? "pr-8" : ""}`}>
                  <div
                    ref={contentRef}
                    className="text-white font-light text-sm leading-relaxed whitespace-pre-wrap break-words"
                  >
                    {isExpanded || !isOverflowing
                      ? displayContent
                      : getTruncatedContent()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Branch picker for an edited prompt with sibling versions. */}
          {!isEditing && branchPicker && (
            <div className="pr-1">{branchPicker}</div>
          )}
        </div>
      </div>
    );
  }

  // Cancelled before any content streamed in: skip the avatar + bubble shell
  // and surface a minimal inline note rather than an orphaned empty block.
  if (message.isCancelled && !displayContent) {
    return (
      <div ref={containerRef} className="flex items-center gap-2 pl-12">
        <span className="w-1.5 h-1.5 rounded-full bg-sbi-muted/60 shrink-0" />
        <p className="text-sbi-muted italic text-sm font-light">
          Response was cancelled
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex items-start gap-4">
      {/* AI Avatar — top-aligned with, and centered to, the first line of text */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center">
          {message.isCancelled ? (
            <div className="w-2.5 h-2.5 bg-sbi-muted/60 rounded-full" />
          ) : (
            <div className="w-2.5 h-2.5 bg-sbi-green rounded-full animate-pulse" />
          )}
        </div>
        <div
          className={`absolute inset-0 w-10 h-10 rounded-full blur-md -z-10 ${message.isCancelled ? "bg-sbi-muted/10" : "bg-sbi-green/20"}`}
        />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {hasTimeline && (
          <div className="mb-3">
            <ProcessTimeline
              steps={timelineSteps}
              streaming={!!message.isStreaming}
              done={timelineDone}
            />
          </div>
        )}
        {message.isCancelled ? (
          <>
            {displayContent && (
              <div className="prose-ai dark text-white font-light text-base leading-relaxed">
                <Streamdown
                  plugins={{ code, math }}
                  components={markdownComponents}
                  shikiTheme={["github-dark", "github-dark"]}
                  isAnimating={false}
                >
                  {displayContent}
                </Streamdown>
              </div>
            )}
            <p
              className={`text-sbi-muted italic text-sm font-light ${displayContent ? "mt-3" : ""}`}
            >
              Response was cancelled
            </p>
          </>
        ) : (
          <>
            <div
              className="prose-ai dark text-white font-light text-base leading-relaxed"
              aria-live="polite"
              aria-busy={message.isStreaming}
            >
              <Streamdown
                plugins={{ code, math }}
                components={markdownComponents}
                shikiTheme={["github-dark", "github-dark"]}
                isAnimating={message.isStreaming && !streamStatusLabel}
                caret="block"
              >
                {displayContent}
              </Streamdown>
            </div>
            {streamStatusLabel && !hasTimeline && (
              <div className="mt-2 flex items-center gap-2 text-sm font-light text-sbi-muted">
                <span>{streamStatusLabel}</span>
                <span className="flex items-center gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-sbi-green/60 animate-pulse"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
            {/* Per-source detail lives in the right-edge Sources panel (latest
                answer) and the inline [n] citation chips; no per-message footer. */}
          </>
        )}

        {/* Action buttons */}
        {!message.isStreaming && (
          <div
            className={`flex items-center gap-1 ${message.isCancelled ? "mt-3" : "mt-4"}`}
          >
            {branchPicker && <div className="mr-1">{branchPicker}</div>}
            {isLatestAssistant && (
              <button
                type="button"
                onClick={regenerateResponse}
                disabled={isLoading}
                aria-label="Regenerate response"
                className="p-1.5 text-sbi-muted hover:text-white hover:bg-sbi-dark-card rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo"
              >
                <RotateCw className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            {!message.isCancelled && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy response"
                className="p-1.5 text-sbi-muted hover:text-white hover:bg-sbi-dark-card rounded-lg transition-colors"
                title="Copy Response"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-sbi-green" />
                ) : (
                  <Copy className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
