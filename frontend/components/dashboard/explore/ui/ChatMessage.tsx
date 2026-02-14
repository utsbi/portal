'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Pencil, MoreHorizontal, ChevronDown, ChevronUp, FileText, File, RotateCw } from 'lucide-react';
import type { DisplayMessage } from '@/lib/chat/chat-context';
import { useChat } from '@/lib/chat/chat-context';

interface ChatMessageProps {
  message: DisplayMessage;
  isLatestAssistant?: boolean;
}

// File type icon and label helper
function getFileInfo(filename: string): { icon: React.ReactNode; label: string; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  switch (ext) {
    case 'pdf':
      return { 
        icon: <div className="w-6 h-6 bg-red-500 rounded-lg text-[9px] font-bold text-white flex items-center justify-center">PDF</div>,
        label: 'PDF',
        color: 'text-red-400'
      };
    case 'doc':
    case 'docx':
      return { 
        icon: <div className="w-6 h-6 bg-blue-600 rounded-lg text-[9px] font-bold text-white flex items-center justify-center">W</div>,
        label: 'DOCX',
        color: 'text-blue-400'
      };
    case 'txt':
      return { 
        icon: <div className="w-6 h-6 bg-blue-400 rounded-lg flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-white" /></div>,
        label: 'TXT',
        color: 'text-blue-300'
      };
    default:
      return { 
        icon: <File className="w-6 h-6 text-sbi-muted" />,
        label: ext.toUpperCase() || 'FILE',
        color: 'text-sbi-muted'
      };
  }
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
          padding: '1rem',
          background: '#0a120c',
          fontSize: '0.875rem',
          borderRadius: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// Custom ReactMarkdown component overrides
const markdownComponents: Components = {
  // Override pre to pass through (CodeBlock handles its own wrapper)
  pre({ children }) {
    return <>{children}</>;
  },
  // Override code: fenced blocks get CodeBlock, inline code stays as <code>
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');

    if (match) {
      return <CodeBlock language={match[1]} code={codeString} />;
    }

    return <code className={className} {...props}>{children}</code>;
  },
};

export function ChatMessage({ message, isLatestAssistant = false }: ChatMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const { editAndResend, isLoading, regenerateResponse } = useChat();

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
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
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const displayContent = message.displayedContent ?? message.content;

  // Truncated content for collapsed view
  const getTruncatedContent = () => {
    const lines = displayContent.split('\n');
    if (lines.length > 5) {
      return lines.slice(0, 5).join('\n') + '...';
    }
    if (displayContent.length > 300 && !displayContent.includes('\n')) {
      return displayContent.slice(0, 300) + '...';
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
    if (editedContent.trim() && editedContent !== message.content && !isLoading) {
      setIsEditing(false);
      await editAndResend(message.id, editedContent.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Get attachments for this message
  const messageAttachments = isUser && message.attachments ? message.attachments : [];

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
                        {attachment.filename.replace(/\.[^/.]+$/, '')}
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
            <div className={`flex items-center gap-1 shrink-0 pt-2 transition-opacity duration-200 ${isHovered && !isEditing ? 'opacity-100' : 'opacity-0'}`}>
              <button
                type="button"
                onClick={handleCopy}
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
                  className="absolute top-2 right-2 p-1 text-sbi-muted hover:text-white hover:bg-sbi-dark rounded-lg transition-colors z-10"
                  title={isExpanded ? 'Collapse' : 'Expand'}
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
                      e.target.style.height = 'auto';
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
                      disabled={!editedContent.trim() || editedContent === message.content || isLoading}
                      className="px-2 py-1 text-xs bg-sbi-green/20 text-sbi-green border border-sbi-green/30 rounded-lg hover:bg-sbi-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`p-3 ${isOverflowing ? 'pr-8' : ''}`}>
                  <div
                    ref={contentRef}
                    className="text-white font-light text-sm leading-relaxed whitespace-pre-wrap wrap-break-word"
                  >
                    {isExpanded || !isOverflowing ? displayContent : getTruncatedContent()}
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
      {/* AI Avatar */}
      <div className="relative shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center">
          {message.isCancelled ? (
            <div className="w-2.5 h-2.5 bg-sbi-muted/60 rounded-full" />
          ) : (
            <div className="w-2.5 h-2.5 bg-sbi-green rounded-full animate-pulse" />
          )}
        </div>
        <div className={`absolute inset-0 w-8 h-8 rounded-full blur-md -z-10 ${message.isCancelled ? 'bg-sbi-muted/10' : 'bg-sbi-green/20'}`} />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 pt-1">
        {message.isCancelled ? (
          <>
            {displayContent && (
              <div className="prose-ai text-white font-light text-base leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            )}
            <p className={`text-sbi-muted italic text-sm font-light ${displayContent ? 'mt-3' : ''}`}>
              Response was cancelled
            </p>
          </>
        ) : (
          <>
            <div className="prose-ai text-white font-light text-base leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {displayContent}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-sbi-green ml-0.5 animate-pulse align-middle" />
              )}
            </div>

            {/* Sources */}
            {message.sources && message.sources.length > 0 && !message.isStreaming && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-sbi-muted-dark tracking-wide uppercase">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {message.sources
                    .filter((source, index, arr) => arr.findIndex(s => s.filename === source.filename) === index)
                    .map((source, index) => {
                    const fileInfo = getFileInfo(source.filename);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-2 bg-sbi-dark-card border border-sbi-dark-border rounded-xl"
                      >
                        {fileInfo.icon}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-white font-light truncate max-w-[150px]">
                            {source.filename.replace(/\.[^/.]+$/, '')}
                            {source.page_number && ` (p. ${source.page_number})`}
                          </span>
                          <span className={`text-xs ${fileInfo.color}`}>
                            {fileInfo.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        {!message.isStreaming && (
          <div className={`flex items-center gap-1 ${message.isCancelled ? 'mt-3' : 'mt-4'}`}>
            {isLatestAssistant && (
              <button
                type="button"
                onClick={regenerateResponse}
                disabled={isLoading}
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
