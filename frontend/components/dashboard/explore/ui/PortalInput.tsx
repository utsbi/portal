'use client';

import React, { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Send, X, FileText, File, Mic, Settings2, Zap, Lightbulb, ChevronDown, Square, Loader2 } from 'lucide-react';
import { useChat, type ModelPreference } from '@/lib/chat/chat-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ModelType = ModelPreference;

interface ModelOption {
  id: ModelType;
  name: string;
  description: string;
  icon: typeof Zap;
}

const modelOptions: ModelOption[] = [
  {
    id: 'fast',
    name: 'Fast',
    description: 'Answers quickly',
    icon: Zap,
  },
  {
    id: 'thinking',
    name: 'Thinking',
    description: 'Solves complex problems',
    icon: Lightbulb,
  },
];

function getFileInfo(filename: string): { icon: React.ReactNode; label: string; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'pdf':
      return {
        icon: <div className="w-6 h-6 bg-red-500 rounded-lg text-[9px] font-bold text-white flex items-center justify-center">PDF</div>,
        label: 'PDF',
        color: 'text-red-400',
      };
    case 'doc':
    case 'docx':
      return {
        icon: <div className="w-6 h-6 bg-blue-600 rounded-lg text-[9px] font-bold text-white flex items-center justify-center">W</div>,
        label: 'DOCX',
        color: 'text-blue-400',
      };
    case 'txt':
      return {
        icon: <div className="w-6 h-6 bg-blue-400 rounded-lg flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-white" /></div>,
        label: 'TXT',
        color: 'text-blue-300',
      };
    default:
      return {
        icon: <File className="w-6 h-6 text-sbi-muted" />,
        label: ext.toUpperCase() || 'FILE',
        color: 'text-sbi-muted',
      };
  }
}

interface PortalInputProps {
  onSubmit?: (query: string) => void;
  disabled?: boolean;
  animated?: boolean;
  queueOnly?: boolean;
}

export function PortalInput({ onSubmit, disabled = false, animated = true, queueOnly = false }: PortalInputProps) {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    messages,
    sendMessage,
    queueMessage,
    addAttachment,
    removeAttachment,
    attachments,
    loadingAttachments,
    isLoading,
    modelPreference,
    setModelPreference,
    cancelRequest,
  } = useChat();

  const isStreaming = messages.some(m => m.isStreaming);

  const handleSubmit = async () => {
    if (!input.trim() || isBusy || disabled) return;
    
    const query = input.trim();
    setInput('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    if (onSubmit) {
      onSubmit(query);
    }

    if (queueOnly) {
      queueMessage(query);
    } else {
      await sendMessage(query);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const name = file.name.toLowerCase();
      const isAccepted = file.type === 'application/pdf'
        || file.type.startsWith('text/')
        || name.endsWith('.doc') || name.endsWith('.docx');
      if (isAccepted) {
        await addAttachment(file);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isBusy = isLoading || isStreaming;
  const isDisabled = isBusy || disabled;
  const hasInput = input.trim().length > 0;
  const currentModel = modelOptions.find(m => m.id === modelPreference) || modelOptions[0];

  return (
    <div className={`input-container space-y-3 ${animated ? 'opacity-0 translate-y-8' : ''}`}>
      {/* Main user input container */}
      <div className="relative group">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Input box with rounded corners */}
        <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-2xl overflow-hidden transition-all duration-300 hover:border-sbi-green/20 focus-within:border-sbi-green/30 focus-within:ring-1 focus-within:ring-sbi-green/20">
          {/* File attachments preview */}
          {(attachments.length > 0 || loadingAttachments.length > 0) && (
            <div className="flex flex-wrap gap-2 px-4 pt-4">
              {/* Loading file attachments */}
              {loadingAttachments.map((filename) => {
                const fileInfo = getFileInfo(filename);
                return (
                  <div
                    key={`loading-${filename}`}
                    className="flex items-center gap-2 px-3 py-2 bg-sbi-dark border border-sbi-dark-border rounded-xl opacity-60"
                  >
                    <div className="relative">
                      <div className="opacity-40">{fileInfo.icon}</div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-white/60 font-light truncate max-w-[120px]">
                        {filename.replace(/\.[^/.]+$/, '')}
                      </span>
                      <span className={`text-xs ${fileInfo.color} opacity-60`}>
                        {fileInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Ready file attachments */}
              {attachments.map((attachment) => {
                const fileInfo = getFileInfo(attachment.filename);
                return (
                  <div
                    key={attachment.filename}
                    className="flex items-center gap-2 px-3 py-2 bg-sbi-dark border border-sbi-dark-border rounded-xl"
                  >
                    {fileInfo.icon}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-white font-light truncate max-w-[120px]">
                        {attachment.filename.replace(/\.[^/.]+$/, '')}
                      </span>
                      <span className={`text-xs ${fileInfo.color}`}>
                        {fileInfo.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.filename)}
                      className="text-sbi-muted hover:text-white transition-colors ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything ..."
            disabled={isDisabled}
            rows={1}
            className="w-full bg-transparent px-5 pt-5 pb-3 text-base text-white font-light tracking-wide placeholder:text-sbi-muted-dark resize-none focus:outline-none disabled:opacity-50 min-h-[52px] max-h-[200px]"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left side buttons */}
            <div className="flex items-center gap-1">
              {/* Add file button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleFileSelect}
                disabled={isDisabled}
                className="h-9 w-9 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" strokeWidth={1.5} />
              </Button>

              {/* Tools button */}
              <Button
                size="sm"
                variant="ghost"
                disabled={isDisabled}
                className="h-9 px-3 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50 gap-1.5"
              >
                <Settings2 className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Tools</span>
              </Button>
            </div>

            {/* Right side - Model picker and send button */}
            <div className="flex items-center gap-2">
              {/* Model picker dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isDisabled}
                    className="h-9 px-3 text-sbi-muted hover:text-white hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50 gap-1.5"
                  >
                    <currentModel.icon className="w-4 h-4 text-sbi-green" strokeWidth={1.5} />
                    <span className="text-sm font-light">{currentModel.name}</span>
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-xl bg-sbi-dark border border-sbi-dark-border p-1 shadow-xl"
                >
                  {modelOptions.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setModelPreference(model.id)}
                      className={`flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                        modelPreference === model.id
                          ? 'bg-sbi-dark-card text-white'
                          : 'text-sbi-muted hover:bg-sbi-dark-card hover:text-white'
                      }`}
                    >
                      <model.icon
                        className={`w-5 h-5 mt-0.5 ${
                          modelPreference === model.id ? 'text-sbi-green' : 'text-sbi-muted'
                        }`}
                        strokeWidth={1.5}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                        </div>
                        <p className="text-xs text-sbi-muted-dark mt-0.5 font-light">
                          {model.description}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Send / Stop / Mic button with transition */}
              {isBusy ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={cancelRequest}
                  className="h-9 w-9 rounded-full bg-sbi-dark-card border border-sbi-dark-border text-white hover:bg-sbi-dark hover:border-sbi-muted transition-all duration-300"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={hasInput ? handleSubmit : undefined}
                  disabled={disabled || (hasInput && !input.trim())}
                  className={`h-9 w-9 rounded-full transition-all duration-300 ${
                    hasInput
                      ? 'bg-sbi-green text-sbi-dark hover:bg-sbi-green/90'
                      : 'text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark'
                  } disabled:opacity-50`}
                >
                  {hasInput ? (
                    <Send className="w-4 h-4" strokeWidth={2} />
                  ) : (
                    <Mic className="w-5 h-5" strokeWidth={1.5} />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Animated underline on focus */}
        <div className="absolute -bottom-0.5 left-4 right-4 h-px bg-sbi-green scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500 origin-center" />
      </div>
    </div>
  );
}

