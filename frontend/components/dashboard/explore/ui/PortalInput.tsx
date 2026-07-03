"use client";

import {
  Check,
  ChevronDown,
  Lightbulb,
  Loader2,
  Mic,
  Plus,
  Send,
  Settings2,
  Square,
  X,
  Zap,
} from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ModelPreference, useChat } from "@/lib/chat/chat-context";
import { getFileInfo } from "./file-info";

type ModelType = ModelPreference;

interface ModelOption {
  id: ModelType;
  name: string;
  description: string;
  icon: typeof Zap;
}

const modelOptions: ModelOption[] = [
  {
    id: "fast",
    name: "Fast",
    description: "Answers quickly",
    icon: Zap,
  },
  {
    id: "thinking",
    name: "Thinking",
    description: "Solves complex problems",
    icon: Lightbulb,
  },
];

// Quick-action prompts surfaced in the Tools menu. Each sends its `prompt` as a
// chat message via the shared chat context (same path as the composer submit).
const toolActions: { label: string; prompt: string }[] = [
  { label: "Summarize my project", prompt: "Summarize my project." },
  { label: "Questionnaire status", prompt: "What is my questionnaire status?" },
  { label: "Latest reports", prompt: "Show me my latest reports." },
  { label: "Finance summary", prompt: "Give me my project's finance summary." },
  { label: "My requests", prompt: "What's the status of my requests?" },
  { label: "Upcoming events", prompt: "What meetings do I have coming up?" },
  { label: "Find a document", prompt: "Help me find a document." },
  { label: "What is SBI?", prompt: "What is SBI?" },
];

interface PortalInputProps {
  onSubmit?: (query: string) => void;
  disabled?: boolean;
  animated?: boolean;
}

export function PortalInput({
  onSubmit,
  disabled = false,
  animated = true,
}: PortalInputProps) {
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    messages,
    sendMessage,
    addAttachment,
    removeAttachment,
    attachments,
    loadingAttachments,
    isLoading,
    modelPreference,
    setModelPreference,
    cancelRequest,
    error,
    clearError,
  } = useChat();

  const isStreaming = messages.some((m) => m.isStreaming);

  // --- Voice input (speech-to-text) ---------------------------------------
  // idle: ready. recording: capturing mic. transcribing: posting to the
  // server-proxied AssemblyAI route. unavailable: mic disabled (permission
  // denied or the server reports the feature isn't configured — 501).
  type VoiceState = "idle" | "recording" | "transcribing" | "unavailable";
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  // Insert transcribed text into the composer: append with a leading space if
  // there's existing content, then refocus so the user can keep editing.
  const insertTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput((prev) => (prev ? `${prev.trimEnd()} ${trimmed}` : trimmed));
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
      }
    });
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setVoiceState("idle");
        return;
      }
      setVoiceState("transcribing");
      setVoiceHint(null);
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob,
        });
        if (res.status === 501) {
          // Feature not configured server-side: disable the mic for good.
          setVoiceState("unavailable");
          setVoiceHint("Voice input isn't available");
          return;
        }
        if (!res.ok) {
          setVoiceState("idle");
          setVoiceHint("Couldn't transcribe audio. Try again.");
          return;
        }
        const data = (await res.json()) as { text?: string };
        insertTranscript(data.text ?? "");
        setVoiceState("idle");
      } catch {
        setVoiceState("idle");
        setVoiceHint("Couldn't transcribe audio. Try again.");
      }
    },
    [insertTranscript],
  );

  const stopRecording = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setVoiceState("unavailable");
      setVoiceHint("Voice input isn't available");
      return;
    }
    setVoiceHint(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const preferred = "audio/webm";
      const mimeType =
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported(preferred)
          ? preferred
          : undefined;
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        releaseStream();
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        void transcribeBlob(blob);
      };

      recorder.start();
      setVoiceState("recording");
      setElapsed(0);
      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } catch {
      releaseStream();
      // Permission denied (or no device): disable and hint at mic access.
      setVoiceState("unavailable");
      setVoiceHint("Enable mic access to use voice input");
    }
  }, [releaseStream, stopTimer, transcribeBlob]);

  // Clean up the stream/timer if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      stopTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseStream();
    };
  }, [stopTimer, releaseStream]);

  const handleMicClick = () => {
    if (voiceState === "recording") {
      stopRecording();
    } else if (voiceState === "idle") {
      void startRecording();
    }
  };

  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleSubmit = async () => {
    if (!input.trim() || isBusy || disabled) return;

    const query = input.trim();
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      // Keep focus so the user can keep typing while the answer streams.
      textareaRef.current.focus();
    }

    if (onSubmit) {
      onSubmit(query);
    }

    await sendMessage(query);
  };

  // Tools quick action: send the canned prompt as a chat message. Mirrors
  // handleSubmit's send path (notify onSubmit, then sendMessage); ignores while
  // a request is in flight or the input is disabled.
  const handleToolAction = async (prompt: string) => {
    if (isBusy || disabled) return;
    if (onSubmit) {
      onSubmit(prompt);
    }
    await sendMessage(prompt);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Single intake for every upload path. addAttachment (chat context) owns the
  // type + size validation, so picker, drag-drop, and paste all behave the same.
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await addAttachment(file);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    // Reset so selecting the same file again re-triggers onChange.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    await handleFiles(e.dataTransfer.files);
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      // Let the file(s) attach; don't also dump their name into the textarea.
      e.preventDefault();
      await handleFiles(files);
    }
  };

  const isBusy = isLoading || isStreaming;
  const hasInput = input.trim().length > 0;
  const currentModel =
    modelOptions.find((m) => m.id === modelPreference) || modelOptions[0];

  return (
    <div
      className={`input-container space-y-3 ${animated ? "opacity-0 translate-y-8" : ""}`}
    >
      {/* Inline error banner — surfaces send failures and attachment-read
          errors (both flow through the shared chat `error` state). Muted red,
          restrained, dismissable. */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2.5"
        >
          <p className="text-red-400 text-xs font-light leading-relaxed">
            {error}
          </p>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="shrink-0 text-red-400/70 hover:text-red-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Voice input hint — surfaces transcription failures and the disabled
          state for the mic. Quiet and restrained; auto-clears on next action. */}
      {voiceHint && (
        <output className="flex items-center gap-2 px-1 text-sbi-muted text-xs font-light">
          <Mic className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>{voiceHint}</span>
        </output>
      )}

      {/* Main user input container */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: file drag-and-drop dropzone; the picker button is the accessible path */}
      <div
        className="relative group"
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          // Ignore leaves into child elements so the overlay doesn't flicker.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-sbi-green/50 bg-sbi-dark/85">
            <span className="text-sm font-light text-sbi-green">
              Drop files to attach
            </span>
          </div>
        )}

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
                        {filename.replace(/\.[^/.]+$/, "")}
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
                        {attachment.filename.replace(/\.[^/.]+$/, "")}
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

          {/* Text area — stays typable while a response streams (only the
              send action is blocked; the button becomes an interrupt). */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask anything ..."
            aria-label="Message"
            disabled={disabled}
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
                disabled={disabled}
                aria-label="Attach file"
                className="h-9 w-9 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" strokeWidth={1.5} />
              </Button>

              {/* Tools menu — quick actions that send a canned prompt as a
                  chat message via the shared chat context. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled || isBusy}
                    aria-label="Tools"
                    className="h-9 px-3 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50 gap-1.5"
                  >
                    <Settings2 className="w-4 h-4" strokeWidth={1.5} />
                    <span className="text-sm font-light">Tools</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={10}
                  aria-label="Quick actions"
                  className="w-60 rounded-xl bg-sbi-dark border border-sbi-dark-border p-1.5 shadow-xl shadow-black/40"
                >
                  <p className="px-2.5 pt-1 pb-1.5 text-[0.7rem] tracking-[0.2em] uppercase text-sbi-muted-dark">
                    Quick actions
                  </p>
                  {toolActions.map((action) => (
                    <DropdownMenuItem
                      key={action.label}
                      onClick={() => void handleToolAction(action.prompt)}
                      aria-label={action.label}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer text-sbi-muted focus:bg-sbi-dark-card focus:text-white"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sbi-green/70 shrink-0" />
                      <span className="text-sm">{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Voice input (speech-to-text). Real recording -> server-proxied
                  AssemblyAI -> inserts text into the composer. Idle shows a mic;
                  recording shows a pulsing dot + elapsed time + stop control;
                  transcribing shows a spinner; unavailable disables the mic. */}
              {voiceState === "recording" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMicClick}
                  aria-label="Stop recording"
                  aria-pressed="true"
                  title="Stop recording"
                  className="h-9 px-3 rounded-full text-sbi-green hover:text-sbi-green hover:bg-sbi-green/10 transition-colors duration-300 gap-2"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-sbi-green opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sbi-green" />
                  </span>
                  <span className="text-sm font-light tabular-nums">
                    {formatElapsed(elapsed)}
                  </span>
                  <Square className="w-3 h-3 fill-current" strokeWidth={0} />
                </Button>
              ) : voiceState === "transcribing" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  aria-label="Transcribing audio"
                  aria-busy="true"
                  className="h-9 px-3 rounded-full text-sbi-muted gap-2 disabled:opacity-100"
                >
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  <span className="text-sm font-light">Transcribing</span>
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleMicClick}
                  disabled={disabled || voiceState === "unavailable"}
                  aria-label="Start voice input"
                  aria-pressed="false"
                  title={
                    voiceState === "unavailable"
                      ? (voiceHint ?? "Voice input isn't available")
                      : "Start voice input"
                  }
                  className="h-9 w-9 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50"
                >
                  <Mic className="w-5 h-5" strokeWidth={1.5} />
                </Button>
              )}
            </div>

            {/* Right side - Model picker and send button */}
            <div className="flex items-center gap-2">
              {/* Model picker dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Response style: ${currentModel.name}`}
                    className="h-9 px-3 text-sbi-muted hover:text-white hover:bg-sbi-dark rounded-full transition-colors duration-300 disabled:opacity-50 gap-1.5"
                  >
                    <currentModel.icon
                      className="w-4 h-4 text-sbi-green"
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-light">
                      {currentModel.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-60 rounded-xl bg-sbi-dark border border-sbi-dark-border p-1.5 shadow-xl shadow-black/40"
                >
                  <p className="px-2.5 pt-1 pb-1.5 text-[0.7rem] tracking-[0.2em] uppercase text-sbi-muted-dark">
                    Response style
                  </p>
                  {modelOptions.map((model) => {
                    const active = modelPreference === model.id;
                    return (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setModelPreference(model.id)}
                        className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer text-sbi-muted focus:bg-sbi-dark-card focus:text-white"
                      >
                        <model.icon
                          className={`w-4 h-4 shrink-0 ${active ? "text-sbi-green" : "text-sbi-muted-dark"}`}
                          strokeWidth={1.5}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm ${active ? "text-white" : ""}`}
                          >
                            {model.name}
                          </div>
                          <p className="text-xs text-sbi-muted-dark font-light">
                            {model.description}
                          </p>
                        </div>
                        {active && (
                          <Check
                            className="w-4 h-4 shrink-0 text-sbi-green"
                            strokeWidth={2}
                          />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Send / Stop button. Empty input shows a disabled send affordance
                  (reduced opacity), not a mic — no voice feature is implied. */}
              {isBusy ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={cancelRequest}
                  aria-label="Stop generating"
                  className="h-9 w-9 rounded-full bg-sbi-dark-card border border-sbi-dark-border text-white hover:bg-sbi-dark hover:border-sbi-muted transition-all duration-300"
                  title="Stop generating"
                >
                  <Square
                    className="w-3.5 h-3.5 fill-current"
                    strokeWidth={0}
                  />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={hasInput ? handleSubmit : undefined}
                  disabled={disabled || !hasInput}
                  aria-label="Send message"
                  className={`h-9 w-9 rounded-full transition-all duration-300 disabled:opacity-50 ${
                    hasInput
                      ? "bg-sbi-green/10 text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark"
                      : "text-sbi-muted"
                  }`}
                >
                  <Send className="w-4 h-4" strokeWidth={2} />
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
