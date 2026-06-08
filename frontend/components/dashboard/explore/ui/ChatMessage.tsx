"use client";

import gsap from "gsap";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  MoreHorizontal,
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
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SourceDocument } from "@/lib/api/chat";
import type { DisplayMessage } from "@/lib/chat/chat-context";
import { useChat } from "@/lib/chat/chat-context";
import { getFileInfo } from "./file-info";

interface ChatMessageProps {
  message: DisplayMessage;
  isLatestAssistant?: boolean;
}

// Custom code block with language label, syntax highlighting, and copy button
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Display name for the language
  const langLabel = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className="rounded-xl border border-sbi-dark-border overflow-hidden my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-sbi-dark-card/80 border-b border-sbi-dark-border">
        <span className="text-sm text-sbi-muted font-medium">{langLabel}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="p-1 text-sbi-muted hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-sbi-green" />
          ) : (
            <Copy className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "var(--color-sbi-dark-card)",
          fontSize: "0.875rem",
          borderRadius: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
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
function interpolateCitations(
  text: string,
  sources: SourceDocument[],
): ReactNode {
  if (sources.length === 0 || !text.includes("[")) return text;
  const parts: ReactNode[] = [];
  const pattern = /\[(\d+)\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    const n = Number.parseInt(match[1], 10);
    if (n < 1 || n > sources.length) continue;
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(
      <CitationChip
        key={`cite-${match.index}-${key++}`}
        index={n}
        source={sources[n - 1]}
      />,
    );
    lastIdx = pattern.lastIndex;
  }
  if (lastIdx === 0) return text; // no matches kept
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

// Build the ReactMarkdown component map for an assistant message, capturing its sources.
function buildMarkdownComponents(sources: SourceDocument[]): Components {
  return {
    pre({ children }) {
      return <>{children}</>;
    },
    code({ className, children, ...props }) {
      const codeString = String(children).replace(/\n$/, "");
      const langMatch = /language-(\w+)/.exec(className || "");
      if (langMatch)
        return <CodeBlock language={langMatch[1]} code={codeString} />;
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    p: ({ children }) => <p>{processCitations(children, sources)}</p>,
    li: ({ children }) => <li>{processCitations(children, sources)}</li>,
    strong: ({ children }) => (
      <strong>{processCitations(children, sources)}</strong>
    ),
    em: ({ children }) => <em>{processCitations(children, sources)}</em>,
    td: ({ children }) => <td>{processCitations(children, sources)}</td>,
    th: ({ children }) => <th>{processCitations(children, sources)}</th>,
    h1: ({ children }) => <h1>{processCitations(children, sources)}</h1>,
    h2: ({ children }) => <h2>{processCitations(children, sources)}</h2>,
    h3: ({ children }) => <h3>{processCitations(children, sources)}</h3>,
    h4: ({ children }) => <h4>{processCitations(children, sources)}</h4>,
    blockquote: ({ children }) => (
      <blockquote>{processCitations(children, sources)}</blockquote>
    ),
  };
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
  const [isHovered, setIsHovered] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const { editAndResend, isLoading, regenerateResponse } = useChat();

  const sources = message.sources ?? [];
  const markdownComponents = useMemo(
    () => buildMarkdownComponents(sources),
    [sources],
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

  // Check if user messages overflows
  useEffect(() => {
    if (contentRef.current && isUser && !isEditing) {
      const lineHeight = 24;
      const maxLines = 5;
      const maxHeight = lineHeight * maxLines;
      setIsOverflowing(contentRef.current.scrollHeight > maxHeight);
    }
  }, [message.content, isUser, isEditing]);

  // Auto-resize
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const displayContent = message.content;

  // Truncated content for collapsed view
  const getTruncatedContent = () => {
    const lines = displayContent.split("\n");
    if (lines.length > 5) {
      return lines.slice(0, 5).join("\n") + "...";
    }
    if (displayContent.length > 300 && !displayContent.includes("\n")) {
      return displayContent.slice(0, 300) + "...";
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
      <div
        ref={containerRef}
        className="flex justify-end mb-6"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
              className={`flex items-center gap-1 shrink-0 pt-2 transition-opacity duration-200 ${isHovered && !isEditing ? "opacity-100" : "opacity-0"}`}
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
                    className="text-white font-light text-sm leading-relaxed whitespace-pre-wrap wrap-break-word"
                  >
                    {isExpanded || !isOverflowing
                      ? displayContent
                      : getTruncatedContent()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex items-start gap-4 mb-6">
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
        {message.isCancelled ? (
          <>
            {displayContent && (
              <div className="prose-ai text-white font-light text-base leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {displayContent}
                </ReactMarkdown>
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
            <div className="prose-ai text-white font-light text-base leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {displayContent}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-sbi-green ml-0.5 animate-pulse align-middle" />
              )}
            </div>
            {/* Per-source detail lives in the right-edge Sources panel (latest
                answer) and the inline [n] citation chips; no per-message footer. */}
          </>
        )}

        {/* Action buttons */}
        {!message.isStreaming && (
          <div
            className={`flex items-center gap-1 ${message.isCancelled ? "mt-3" : "mt-4"}`}
          >
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
                title="Copy Reponse"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-sbi-green" />
                ) : (
                  <Copy className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            )}
            <button
              type="button"
              aria-label="More options"
              className="p-1.5 text-sbi-muted hover:text-white hover:bg-sbi-dark-card rounded-lg transition-colors"
              title="More"
            >
              <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
