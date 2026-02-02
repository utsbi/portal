'use client';

import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Send, X, FileText, Loader2 } from 'lucide-react';
import { useChat } from '@/lib/chat/chat-context';

interface PortalInputProps {
  onSubmit?: (query: string) => void;
  disabled?: boolean;
}

export function PortalInput({ onSubmit, disabled = false }: PortalInputProps) {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, addAttachment, removeAttachment, attachments, isLoading } = useChat();

  const handleSubmit = async () => {
    if (!input.trim() || isLoading || disabled) return;
    
    const query = input.trim();
    setInput('');
    
    if (onSubmit) {
      onSubmit(query);
    }
    
    await sendMessage(query);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      // Only accept PDFs and text files for now
      if (file.type === 'application/pdf' || file.type.startsWith('text/')) {
        await addAttachment(file);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isDisabled = isLoading || disabled;

  return (
    <div className="input-container opacity-0 translate-y-8 space-y-3">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.filename}
              className="flex items-center gap-2 px-3 py-1.5 bg-sbi-dark-card border border-sbi-dark-border rounded text-sm"
            >
              <FileText className="w-4 h-4 text-sbi-green" strokeWidth={1.5} />
              <span className="text-sbi-muted font-light truncate max-w-[150px]">
                {attachment.filename}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.filename)}
                className="text-sbi-muted hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input field */}
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

        {/* Add file button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={handleFileSelect}
          disabled={isDisabled}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark-card z-10 transition-colors duration-300 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" strokeWidth={1.5} />
        </Button>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything ..."
          disabled={isDisabled}
          className="w-full bg-sbi-dark-card border border-sbi-dark-border pl-12 pr-14 py-6 text-base text-white font-light tracking-wide focus:ring-1 focus:ring-sbi-green/30 focus:border-sbi-green/30 placeholder:text-sbi-muted-dark transition-all duration-300 hover:border-sbi-green/20 disabled:opacity-50"
        />

        {/* Send button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSubmit}
          disabled={!input.trim() || isDisabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark-card z-10 transition-colors duration-300 disabled:opacity-30"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Send className="w-5 h-5" strokeWidth={1.5} />
          )}
        </Button>

        <div className="absolute bottom-0 left-0 w-0 h-px bg-sbi-green group-focus-within:w-full transition-all duration-500" />
      </div>
    </div>
  );
}

