"use client";

import { code } from "@streamdown/code";
import gsap from "gsap";
import {
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SourceDocument } from "@/lib/api/chat";
import type { DisplayMessage, TimelineStep } from "@/lib/chat/chat-context";
import { useChat } from "@/lib/chat/chat-context";
import { getFileInfo } from "./file-info";
import { ProcessTimeline } from "./ProcessTimeline";

interface ChatMessageProps {
  message: DisplayMessage;
  isLatestAssistant?: boolean;
}

// Inline citation chip: numeric badge with hover-card preview, links to /dashboard/files.
function CitationChip({
  index,
  source,
}: {
  index: number;
  source: SourceDocument;
}) {
  const filename = source.filename;
  const preview = (source.content || "").slice(0, 220).trim();
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/dashboard/files?file=${encodeURIComponent(filename)}`}
            className="inline-flex items-center justify-center align-baseline mx-0.5 px-1.5 h-5 text-[11px] font-medium text-sbi-green/90 bg-sbi-green/10 border border-sbi-green/30 rounded-md no-underline hover:bg-sbi-green/20 hover:text-sbi-green transition-colors"
            aria-label={`Source ${index}: ${filename}`}
          >
            {index}
          </Link>
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
        {/* Content column, right aligned, set width */}
        <div className="flex flex-col items-end gap-2 max-w-[80%] overflow-hidden">
          {/* Attached files, horizontal row, right-aligned */}
          {messageAttachments.length > 0 && !isEditing && (
            <div className="flex flex-row flex-wrap justify-end gap-2">
              {messageAttachments.map((attachment) => {
                const fileInfo = getFileInfo(attachment.filename);
                return (
                  <div
                    key={attachment.filename}
                    className="flex items-center gap-2 px-3 py-2 bg-sbi-dark-card/80 border border-sbi-dark-border rounded-xl"
                  >
                    {fileInfo.icon}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-white font-light truncate max-w-40">
                        {attachment.filename.replace(/\.[^/.]+$/, "")}
                      </span>
                      <span className={`text-xs ${fileInfo.color}`}>
                        {fileInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Message row - on hover icons and msg bubble */}
          <div className="flex items-start gap-2 min-w-0 w-full justify-end">
            {/* Action buttons - left of msg bubble, aligned top */}
            <div
              className={`flex items-center gap-1 shrink-0 pt-2 transition-opacity duration-200 ${
                isEditing
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
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
            <div className="min-w-0 bg-sbi-dark-card/80 border border-sbi-green/20 rounded-2xl overflow-hidden relative">
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
        <div className="w-8 h-8 rounded-full bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center">
          {message.isCancelled ? (
            <div className="w-2.5 h-2.5 bg-sbi-muted/60 rounded-full" />
          ) : (
            <div className="w-2.5 h-2.5 bg-sbi-green rounded-full animate-pulse" />
          )}
        </div>
        <div
          className={`absolute inset-0 w-8 h-8 rounded-full blur-md -z-10 ${message.isCancelled ? "bg-sbi-muted/10" : "bg-sbi-green/20"}`}
        />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 pt-1">
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
                  plugins={{ code }}
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
                plugins={{ code }}
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
