"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type AttachmentFile,
  type ChatMessage,
  extractFileText,
  type SourceDocument,
  sendChatMessage,
  type ToolEvent,
} from "@/lib/api/chat";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";

export type ModelPreference = "fast" | "thinking";

export type LoadingPhase =
  | "idle"
  | "thinking"
  | "planning"
  | "searching"
  | "generating"
  | "complete"
  | "error";

export interface MessageAttachment {
  filename: string;
  /** Full extracted text. Present on legacy inline rows; absent on new reference rows. */
  content?: string;
  /** SHA-256 hash referencing a row in client_chat_attachments. Set on new rows. */
  hash?: string;
  /** MIME sub-type (e.g. "txt", "pdf"). Stored alongside hash for the resolver. */
  file_type?: string;
}

// A source row carried by a tool result (filename + optional page).
export interface ToolStepSource {
  filename?: string | null;
  page_number?: number | null;
}

// The output of a completed tool call: cited sources and/or a text summary.
export interface ToolStepOutput {
  sources?: ToolStepSource[];
  text?: string;
}

// One ordered step in an assistant turn's "process timeline" — either a chunk of
// streamed reasoning or a tool call. Reasoning chunks are coalesced into the
// trailing reasoning step so reasoning → tool → reasoning interleaves in order.
// Persisted: the API route writes this (as `process_steps` jsonb) incrementally
// as it streams, so a reload, tab switch, or cancel reconstructs the timeline.
export type TimelineStep =
  | { kind: "reasoning"; text: string }
  | {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      state: "running" | "done";
      output?: ToolStepOutput;
    };

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceDocument[];
  attachments?: MessageAttachment[];
  timestamp: Date;
  isStreaming?: boolean;
  isCancelled?: boolean;
  // Reasoning/thinking tokens streamed before the answer on thinking-model
  // turns. Persisted (column `reasoning`) and re-derived on reload, so it shows
  // on both live and reloaded turns.
  reasoning?: string;
  // Ordered process timeline (reasoning chunks interleaved with tool calls)
  // streamed during the turn. Drives the ProcessTimeline UI. Persisted (column
  // `process_steps`) and rebuilt by buildActiveBranch, so reloaded turns keep it.
  steps?: TimelineStep[];
  // Branch navigation, set only on messages backed by a persisted DB row whose
  // parent has sibling branches (created by edit/regenerate). `dbId` is the row id
  // (used to switch branches); `branchIndex`/`branchCount` drive the ‹ i/n › picker.
  dbId?: number;
  branchIndex?: number;
  branchCount?: number;
}

// A persisted message row, as selected from client_chat_messages. Messages form a
// parent/child tree: rows sharing a parent_id are alternative branches of the same
// point. The displayed thread is one root->leaf path through that tree.
// `reasoning` and `process_steps` are the persisted form of the per-turn
// ProcessTimeline (thinking chunks + tool calls) — populated by the API route
// incrementally as events stream, so a reload, tab switch, or cancel-and-reload
// can reconstruct the timeline exactly as it was streamed.
type MessageRow = {
  id: number;
  parent_id: number | null;
  role: string;
  content: string;
  sources: unknown;
  attachments: unknown;
  is_cancelled: boolean;
  created_at: string;
  reasoning: unknown;
  process_steps: unknown;
};

// Derive the visible (active) branch from the full set of session rows. Walks from
// the active leaf up to the root, then maps to DisplayMessages, tagging each with
// its sibling-branch position so the UI can render a ‹ i/n › picker. `activeLeafId`
// selects which branch is active; null falls back to the newest row.
function buildActiveBranch(
  rows: MessageRow[],
  activeLeafId: number | null,
): DisplayMessage[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => a.id - b.id);
  const byId = new Map<number, MessageRow>();
  const childrenByParent = new Map<number | null, MessageRow[]>();
  let maxLeaf: MessageRow | null = null;
  for (const r of sorted) {
    byId.set(r.id, r);
    if (!maxLeaf || r.id > maxLeaf.id) maxLeaf = r;
    const kids = childrenByParent.get(r.parent_id);
    if (kids) kids.push(r);
    else childrenByParent.set(r.parent_id, [r]); // children stay id-ascending
  }

  const leaf =
    (activeLeafId != null ? byId.get(activeLeafId) : null) ?? maxLeaf;

  const path: MessageRow[] = [];
  const seen = new Set<number>();
  for (let cur: MessageRow | null = leaf; cur && !seen.has(cur.id); ) {
    seen.add(cur.id);
    path.push(cur);
    cur = cur.parent_id != null ? (byId.get(cur.parent_id) ?? null) : null;
  }
  path.reverse();

  // Degenerate path (rows written before parent_id existed are unparented, so the
  // leaf walk reaches only itself) -> render the whole thread chronologically and
  // suppress branch pickers, since the null-parent rows aren't real siblings.
  const isDegenerate = path.length <= 1 && rows.length > 1;
  const activePath = isDegenerate ? sorted : path;

  return activePath
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => {
      const siblings = isDegenerate
        ? []
        : (childrenByParent.get(row.parent_id) ?? []);
      const branchCount = siblings.length;
      const hasBranches = branchCount > 1;
      // The persisted process_steps jsonb has the same TimelineStep shape the
      // live UI builds; rebuild it here so a reloaded turn renders its full
      // timeline (reasoning chunks + tool calls + their results) instead of
      // silently dropping it. Falls back to a single reasoning step when the
      // backend streamed a `reasoning` event but no tool calls (mirrors the
      // live-stream fallback in ChatMessage.tsx).
      const persistedSteps = Array.isArray(row.process_steps)
        ? (row.process_steps as TimelineStep[])
        : null;
      const reasoningText =
        typeof row.reasoning === "string" && row.reasoning.trim()
          ? row.reasoning.trim()
          : null;
      const steps: TimelineStep[] | undefined =
        persistedSteps && persistedSteps.length > 0
          ? persistedSteps
          : reasoningText
            ? [{ kind: "reasoning", text: reasoningText }]
            : undefined;
      return {
        id: `db-${row.id}`,
        dbId: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        sources: (row.sources as SourceDocument[] | null) ?? undefined,
        attachments:
          (row.attachments as MessageAttachment[] | null) ?? undefined,
        timestamp: new Date(row.created_at),
        isCancelled: row.is_cancelled || undefined,
        // Re-derive reasoning and steps from the persisted row so the
        // ProcessTimeline UI renders on reloaded turns.
        reasoning: reasoningText ?? undefined,
        steps,
        branchCount: hasBranches ? branchCount : undefined,
        branchIndex: hasBranches
          ? siblings.findIndex((s) => s.id === row.id) + 1
          : undefined,
      };
    });
}

export interface SessionSummary {
  id: number;
  public_id: string;
  title: string | null;
  updated_at: string | null;
  project_id: number | null;
  pinned: boolean;
}

interface ChatContextType {
  messages: DisplayMessage[];
  sessionId: number | null;
  sessionPublicId: string | null;
  sessionTitle: string | null;
  loadingPhase: LoadingPhase;
  isLoading: boolean;
  // True while a turn is in flight, including the token-streaming window (when
  // isLoading is already false). Branch switching is disabled during this.
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
  // True when the most recent loadSession() failed to hydrate a conversation
  // (unknown id, RLS, or fetch error). Lets the surface show an empty/error
  // state instead of a blank thread. Reset on any successful load / new session.
  loadFailed: boolean;
  // True while loadSession() is fetching a conversation's history. Lets the
  // surface show a loading skeleton instead of a momentarily-empty thread.
  isHydrating: boolean;
  attachments: AttachmentFile[];
  loadingAttachments: string[];
  modelPreference: ModelPreference;
  setModelPreference: (model: ModelPreference) => void;
  sendMessage: (query: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (filename: string) => void;
  clearChat: () => void;
  cancelRequest: () => void;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: () => Promise<void>;
  // Switch which sibling branch of a message is active (direction -1 = previous,
  // +1 = next). Re-renders the thread along the chosen branch and persists it.
  switchBranch: (dbId: number, direction: -1 | 1) => void;
  newSession: () => void;
  loadSession: (publicId: string) => Promise<boolean>;
  listSessions: () => Promise<SessionSummary[]>;
  renameSession: (sessionId: number, title: string) => Promise<void>;
  setPinned: (sessionId: number, pinned: boolean) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
  sessionList: SessionSummary[];
  sessionsLoaded: boolean;
  refreshSessions: () => Promise<SessionSummary[]>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessionId, setSessionIdState] = useState<number | null>(null);
  const [sessionPublicId, setSessionPublicIdState] = useState<string | null>(
    null,
  );
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  // True for the whole lifetime of an in-flight turn (request start -> stream
  // settled), unlike `isLoading` which flips to false once the first token
  // arrives. Used to disable branch switching while a turn is streaming.
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [modelPreference, setModelPreference] =
    useState<ModelPreference>("fast");
  const [loadingAttachments, setLoadingAttachments] = useState<string[]>([]);
  // Shared, cached conversation list. Lives here (provider stays mounted for the
  // whole dashboard session) so the history sidebar and the /chats page read the
  // same data without refetching on every open.
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const sessionsLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  // Full message tree of the open session (every branch, not just the visible
  // one). Kept so the branch picker can navigate to sibling branches without a
  // refetch. Repopulated by loadSession and after each completed turn.
  const treeRowsRef = useRef<MessageRow[]>([]);

  // Active project, read through a ref so runAgent stays stable (no re-creation
  // on project switch) while always sending the currently-selected project id.
  // The assistant scopes its live-data tools to this; the backend re-verifies
  // membership, so it is a scope hint, not a capability.
  const { activeProject } = useProject();
  const projectIdRef = useRef<number | null>(activeProject?.projectId ?? null);
  projectIdRef.current = activeProject?.projectId ?? null;

  const isLoading =
    loadingPhase !== "idle" &&
    loadingPhase !== "complete" &&
    loadingPhase !== "error";

  const setSessionId = useCallback((id: number | null) => {
    sessionIdRef.current = id;
    setSessionIdState(id);
  }, []);

  const setSessionPublicId = useCallback((pid: string | null) => {
    setSessionPublicIdState(pid);
  }, []);

  // Resolve a session's opaque public_id from its bigint id (used after the
  // backend creates a new session and only returns the numeric id).
  const syncPublicId = useCallback(
    async (id: number) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("client_chat_sessions")
        .select("public_id, title")
        .eq("id", id)
        .maybeSingle();
      if (data?.public_id) setSessionPublicId(data.public_id as string);
      if (data) setSessionTitle((data.title as string | null) ?? null);
    },
    [setSessionPublicId],
  );

  const collectSessionAttachments = useCallback(
    (
      msgs: DisplayMessage[],
      extraAttachments?: AttachmentFile[],
    ): AttachmentFile[] => {
      const seen = new Set<string>();
      const all: AttachmentFile[] = [];

      for (const msg of msgs) {
        if (msg.role === "user" && msg.attachments) {
          for (const a of msg.attachments) {
            if (seen.has(a.filename)) continue;
            seen.add(a.filename);
            if (a.hash) {
              // New reference shape: route resolves content from
              // client_chat_attachments — no full text in the request body.
              all.push({
                filename: a.filename,
                hash: a.hash,
                file_type: a.file_type ?? "txt",
              });
            } else if (a.content) {
              // Legacy inline shape (conversations persisted before this change).
              // Pass full content so the stateless backend still receives it.
              all.push({
                filename: a.filename,
                content: a.content,
                file_type:
                  a.file_type ??
                  a.filename.split(".").pop()?.toLowerCase() ??
                  "txt",
              });
            }
            // else: no hash AND no content — skip (unresolvable; turn still sends)
          }
        }
      }

      if (extraAttachments) {
        for (const a of extraAttachments) {
          if (seen.has(a.filename)) continue;
          seen.add(a.filename);
          if (a.hash) {
            // Freshly staged attachment: content is stored in DB, send reference.
            all.push({
              filename: a.filename,
              hash: a.hash,
              file_type: a.file_type,
            });
          } else if (a.content) {
            all.push(a);
          }
        }
      }

      return all;
    },
    [],
  );

  const handlePhase = useCallback((phase: string) => {
    if (!cancelledRef.current) setLoadingPhase(phase as LoadingPhase);
  }, []);

  // After a completed turn, reconcile the in-memory tree + branch metadata from
  // the DB WITHOUT remounting messages. The streamed messages keep their ephemeral
  // ids, content and reasoning; we only graft on dbId + branch position by index.
  // This is what makes the ‹ i/n › picker appear right after an edit/regenerate
  // (which forked a branch) without re-animating the whole thread. If the live and
  // persisted shapes diverge we skip the graft and let loadSession reconcile later.
  const refreshBranchMeta = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid == null) return;
    const supabase = createClient();
    const [{ data: msgData }, { data: sessData }] = await Promise.all([
      supabase
        .from("client_chat_messages")
        .select(
          "id, parent_id, role, content, sources, attachments, is_cancelled, created_at, reasoning, process_steps",
        )
        .eq("session_id", sid)
        .order("created_at", { ascending: true }),
      supabase
        .from("client_chat_sessions")
        .select("metadata")
        .eq("id", sid)
        .maybeSingle(),
    ]);
    const rows = (msgData ?? []) as MessageRow[];
    treeRowsRef.current = rows;
    // Build the active branch from the AUTHORITATIVE leaf (the route advances
    // active_leaf_id to the answer it just wrote), not the highest-id row — those
    // diverge if a row from another branch sorts later.
    const meta =
      sessData?.metadata && typeof sessData.metadata === "object"
        ? (sessData.metadata as Record<string, unknown>)
        : {};
    const activeLeafId =
      typeof meta.active_leaf_id === "number" ? meta.active_leaf_id : null;
    const derived = buildActiveBranch(rows, activeLeafId);
    setMessages((live) => {
      if (derived.length !== live.length) return live;
      // Graft branch metadata by position — but only when every role lines up. A
      // shape mismatch means `derived` isn't the branch on screen (a divergent
      // branch of equal length), so leave live messages alone and let the next
      // loadSession reconcile rather than mislabel dbIds.
      for (let i = 0; i < live.length; i++) {
        if (live[i].role !== derived[i].role) return live;
      }
      return live.map((m, i) => ({
        ...m,
        dbId: derived[i].dbId,
        branchCount: derived[i].branchCount,
        branchIndex: derived[i].branchIndex,
      }));
    });
  }, []);

  const runAgent = useCallback(
    async (
      query: string,
      history: ChatMessage[],
      sessionAttachments: AttachmentFile[],
      abortController: AbortController,
      regenerate = false,
    ): Promise<boolean> => {
      setLoadingPhase("thinking");
      setIsStreaming(true);

      // Hoisted above the try so the catch can settle the streaming message it
      // created (stop the timeline spinner / resolve in-flight tool steps).
      let assistantId: string | null = null;
      try {
        // Brand-new conversation: mint the chat's uuid client-side so the URL is
        // correct before the first response (the API route creates the session
        // with it). syncPublicId reconciles from the DB afterwards as a safety net.
        let newPublicId: string | null = null;
        if (sessionIdRef.current === null) {
          newPublicId = crypto.randomUUID();
          setSessionPublicId(newPublicId);
        }

        const response = await sendChatMessage(
          {
            query,
            history,
            attachments: sessionAttachments,
            include_sources: true,
            model_preference: modelPreference,
            session_id: sessionIdRef.current,
            public_id: newPublicId,
            regenerate,
            project_id: projectIdRef.current,
          },
          abortController.signal,
          handlePhase,
          (delta) => {
            if (cancelledRef.current || !delta) return;
            // An answer token means we're past thinking/searching/generating —
            // clear the global loader on EVERY delta, not just the first. On a
            // multi-iteration tool turn the message is created early (by the
            // decision step's reasoning), so a later searching/generating phase
            // would otherwise leave "Writing response" stuck for the whole answer.
            setLoadingPhase("complete");
            if (assistantId === null) {
              const id = `assistant-${Date.now()}`;
              assistantId = id;
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  role: "assistant",
                  content: delta,
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ]);
            } else {
              const id = assistantId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id ? { ...m, content: m.content + delta } : m,
                ),
              );
            }
          },
          (newSessionId) => {
            if (sessionIdRef.current !== newSessionId) {
              setSessionId(newSessionId);
              void syncPublicId(newSessionId);
            }
          },
          (reasoning) => {
            if (cancelledRef.current || !reasoning) return;
            // Reasoning can arrive before the first answer delta — create the
            // streaming assistant message so the timeline renders live, then
            // extend it (mirrors the content-delta handler). Each chunk is also
            // coalesced into the trailing `steps` reasoning entry so reasoning ⇄
            // tool interleaving stays in stream order.
            if (assistantId === null) {
              const id = `assistant-${Date.now()}`;
              assistantId = id;
              setLoadingPhase("complete");
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  role: "assistant",
                  content: "",
                  reasoning,
                  steps: [{ kind: "reasoning", text: reasoning }],
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ]);
            } else {
              const id = assistantId;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== id) return m;
                  const steps = m.steps ? [...m.steps] : [];
                  const last = steps[steps.length - 1];
                  if (last && last.kind === "reasoning") {
                    steps[steps.length - 1] = {
                      ...last,
                      text: last.text + reasoning,
                    };
                  } else {
                    steps.push({ kind: "reasoning", text: reasoning });
                  }
                  return {
                    ...m,
                    reasoning: (m.reasoning ?? "") + reasoning,
                    steps,
                  };
                }),
              );
            }
          },
          (toolEvent: ToolEvent) => {
            if (cancelledRef.current) return;
            // A tool call/result mid-turn. Ensure the streaming assistant message
            // exists (a tool can fire before any reasoning/answer), then push the
            // tool step or mark it done. Deliberately does NOT clear the loader —
            // a tool call means the turn is still working (searching phase).
            if (assistantId === null) {
              const id = `assistant-${Date.now()}`;
              assistantId = id;
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  role: "assistant",
                  content: "",
                  steps: [],
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ]);
            }
            const id = assistantId;
            if (toolEvent.type === "tool_call") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== id) return m;
                  const steps = m.steps ? [...m.steps] : [];
                  steps.push({
                    kind: "tool",
                    toolCallId: toolEvent.id,
                    toolName: toolEvent.name,
                    state: "running",
                  });
                  return { ...m, steps };
                }),
              );
            } else {
              // tool_result — mark the matching step done and attach its output.
              const output: ToolStepOutput = {
                sources: Array.isArray(toolEvent.output?.sources)
                  ? (toolEvent.output?.sources as ToolStepSource[])
                  : undefined,
                text:
                  typeof toolEvent.output?.text === "string"
                    ? toolEvent.output.text
                    : undefined,
              };
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== id) return m;
                  const steps = m.steps ? [...m.steps] : [];
                  // Resolve the most recent STILL-RUNNING tool step with this id.
                  // The running guard means a duplicate/colliding id can never
                  // re-mark an already-completed card (defense for backend ids).
                  for (let i = steps.length - 1; i >= 0; i--) {
                    const s = steps[i];
                    if (
                      s.kind === "tool" &&
                      s.toolCallId === toolEvent.id &&
                      s.state === "running"
                    ) {
                      steps[i] = { ...s, state: "done", output };
                      break;
                    }
                  }
                  return { ...m, steps };
                }),
              );
            }
          },
        );

        if (cancelledRef.current) return false;

        if (assistantId !== null) {
          const id = assistantId;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    content: response.answer,
                    sources: response.sources,
                    isStreaming: false,
                    timestamp: new Date(response.timestamp),
                  }
                : m,
            ),
          );
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: response.answer,
              sources: response.sources,
              timestamp: new Date(response.timestamp),
              isStreaming: false,
            },
          ]);
          setLoadingPhase("complete");
        }
        // Streaming finished successfully — force the loader to its terminal
        // state so it can never linger if the last phase event was a loading
        // one (a multi-iteration tool turn ends mid-"generating" phase).
        setLoadingPhase("complete");
        // The backend auto-titles the session after the first turn; refresh the
        // title (and public_id) so the header updates from "Untitled".
        if (sessionIdRef.current !== null)
          void syncPublicId(sessionIdRef.current);
        // Reconcile branch metadata (the just-finished edit/regenerate forked a
        // branch the picker should now surface) without remounting the thread.
        void refreshBranchMeta();
        return true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setLoadingPhase("idle");
          return false;
        }
        setLoadingPhase("error");
        setError(err instanceof Error ? err.message : "Failed to send message");
        // Settle the partially-streamed assistant message (if one was created)
        // so its timeline stops streaming and any in-flight tool step resolves —
        // otherwise the header spinner / tool card would hang after the error.
        if (assistantId !== null) {
          const id = assistantId;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    isStreaming: false,
                    steps: m.steps?.map((s) =>
                      s.kind === "tool" && s.state === "running"
                        ? { ...s, state: "done" }
                        : s,
                    ),
                  }
                : m,
            ),
          );
        }
        setTimeout(() => setLoadingPhase("idle"), 3000);
        return false;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      modelPreference,
      handlePhase,
      setSessionId,
      setSessionPublicId,
      syncPublicId,
      refreshBranchMeta,
    ],
  );

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      setError(null);
      cancelledRef.current = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Store reference shape {filename, hash, file_type} for new attachments so
      // the persisted row never carries full content; legacy inline path kept as
      // fallback when store failed (hash absent).
      const messageAttachments: MessageAttachment[] = attachments.map((a) =>
        a.hash
          ? { filename: a.filename, hash: a.hash, file_type: a.file_type }
          : { filename: a.filename, content: a.content },
      );

      const userMessage: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: query,
        attachments:
          messageAttachments.length > 0 ? messageAttachments : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const allAttachments = collectSessionAttachments(messages, attachments);

      const ok = await runAgent(
        query,
        history,
        allAttachments,
        abortController,
      );
      if (ok) setAttachments([]);
    },
    [messages, attachments, runAgent, collectSessionAttachments],
  );

  // Re-run the latest user turn. Used when a send failed (the user message is
  // kept, no assistant reply) or a reloaded thread ends on an unanswered user
  // message. This forks a fresh user turn from the same branch point; the
  // previous unanswered turn stays in the tree on an abandoned branch.
  const retryLastMessage = useCallback(async () => {
    let idx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;
    const userMsg = messages[idx];
    const base = messages.slice(0, idx + 1);
    setMessages(base);
    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const history: ChatMessage[] = messages
      .slice(0, idx)
      .map((m) => ({ role: m.role, content: m.content }));
    await runAgent(
      userMsg.content,
      history,
      collectSessionAttachments(base, []),
      abortController,
    );
  }, [messages, runAgent, collectSessionAttachments]);

  const addAttachment = useCallback(async (file: File) => {
    // Single gate for every upload path (picker, drag-drop, paste). Type list
    // mirrors the /api/chat/extract allowlist; size cap mirrors its 10 MB limit
    // so oversized files are rejected before the round-trip, not after.
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    const name = file.name.toLowerCase();
    const accepted =
      file.type === "application/pdf" ||
      file.type.startsWith("text/") ||
      file.type.startsWith("image/") ||
      name.endsWith(".pdf") ||
      name.endsWith(".txt") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx") ||
      /\.(png|jpe?g|webp|gif)$/.test(name);
    if (!accepted) {
      setError(
        `"${file.name}" isn't a supported type (PDF, DOC, DOCX, TXT, or an image).`,
      );
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`"${file.name}" is larger than the 10 MB limit.`);
      return;
    }

    const filename = file.name;
    setLoadingAttachments((prev) => [...prev, filename]);

    try {
      const attachmentData = await extractFileText(file);
      setAttachments((prev) => [...prev, attachmentData]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setLoadingAttachments((prev) => prev.filter((f) => f !== filename));
    }
  }, []);

  const removeAttachment = useCallback((filename: string) => {
    setAttachments((prev) => prev.filter((a) => a.filename !== filename));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const cancelRequest = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingPhase("idle");
    setMessages((prev) => {
      const hasStreaming = prev.some((m) => m.isStreaming);
      if (hasStreaming) {
        return prev.map((m) =>
          m.isStreaming
            ? {
                ...m,
                isStreaming: false,
                isCancelled: true,
                // Resolve any in-flight tool step so its card doesn't hang on
                // "Running…" forever once the turn is torn down.
                steps: m.steps?.map((s) =>
                  s.kind === "tool" && s.state === "running"
                    ? { ...s, state: "done" }
                    : s,
                ),
              }
            : m,
        );
      }
      return [
        ...prev,
        {
          id: `assistant-cancelled-${Date.now()}`,
          role: "assistant" as const,
          content: "",
          timestamp: new Date(),
          isStreaming: false,
          isCancelled: true,
        },
      ];
    });
  }, []);

  // editAndResend / regenerateResponse fork a new branch. The client shows the
  // new turn (truncating its view to the branch point); the route preserves the
  // superseded turn(s) as an off-path branch by parenting the new turn to
  // active_path[history.length-1]. loadSession walks only the active branch on
  // reload, so the old branch stays in the DB but off-screen (a future branch
  // picker can surface it). No client-side DB ids are needed — the route maps
  // history position to the branch point.
  const editAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      const messagesUpToEdited = messages.slice(0, messageIndex + 1);
      const allSessionAttachments =
        collectSessionAttachments(messagesUpToEdited);
      const historyMessages = messages.slice(0, messageIndex);
      const history: ChatMessage[] = historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => {
        const updated = [...prev];
        updated[messageIndex] = {
          ...updated[messageIndex],
          content: newContent,
        };
        return updated.slice(0, messageIndex + 1);
      });

      setError(null);
      cancelledRef.current = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setTimeout(() => {
        runAgent(newContent, history, allSessionAttachments, abortController);
      }, 0);
    },
    [messages, runAgent, collectSessionAttachments],
  );

  const regenerateResponse = useCallback(async () => {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    let userIdx = -1;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;

    const query = messages[userIdx].content;
    const historyMessages = messages.slice(0, userIdx);
    const history: ChatMessage[] = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const lastAssistantId = messages[lastAssistantIdx].id;
    const allSessionAttachments = collectSessionAttachments(
      messages.slice(0, userIdx + 1),
    );

    setMessages((prev) => prev.filter((m) => m.id !== lastAssistantId));

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // regenerate=true: the route persists a new answer as a sibling under the
    // EXISTING user turn rather than inserting a duplicate user row.
    await runAgent(
      query,
      history,
      allSessionAttachments,
      abortController,
      true,
    );
  }, [messages, runAgent, collectSessionAttachments]);

  // Navigate to a sibling branch of `dbId` (direction -1 = previous, +1 = next).
  // Re-renders the thread along the chosen branch (descending to its newest leaf)
  // and persists that leaf so reloads and the next turn follow it.
  const switchBranch = useCallback((dbId: number, direction: -1 | 1) => {
    const rows = treeRowsRef.current;
    if (rows.length === 0) return;

    const byId = new Map<number, MessageRow>();
    const childrenByParent = new Map<number | null, MessageRow[]>();
    for (const r of [...rows].sort((a, b) => a.id - b.id)) {
      byId.set(r.id, r);
      const kids = childrenByParent.get(r.parent_id);
      if (kids) kids.push(r);
      else childrenByParent.set(r.parent_id, [r]);
    }

    const node = byId.get(dbId);
    if (!node) return;
    const siblings = childrenByParent.get(node.parent_id) ?? [];
    const pos = siblings.findIndex((s) => s.id === dbId);
    const target = siblings[pos + direction];
    if (!target) return; // already at an end — nothing to switch to

    // Descend to a leaf, taking the newest child at each level, so switching back
    // restores the most recent state of that branch (not an abandoned mid-point).
    let leaf = target;
    const guard = new Set<number>();
    while (!guard.has(leaf.id)) {
      guard.add(leaf.id);
      const kids = childrenByParent.get(leaf.id);
      if (!kids || kids.length === 0) break;
      leaf = kids[kids.length - 1];
    }

    setMessages(buildActiveBranch(rows, leaf.id));

    const sid = sessionIdRef.current;
    if (sid != null) {
      const supabase = createClient();
      void (async () => {
        const { data } = await supabase
          .from("client_chat_sessions")
          .select("metadata")
          .eq("id", sid)
          .maybeSingle();
        const meta =
          data?.metadata && typeof data.metadata === "object"
            ? (data.metadata as Record<string, unknown>)
            : {};
        await supabase
          .from("client_chat_sessions")
          .update({ metadata: { ...meta, active_leaf_id: leaf.id } })
          .eq("id", sid);
      })();
    }
  }, []);

  const newSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setAttachments([]);
    setLoadingAttachments([]);
    setLoadingPhase("idle");
    setError(null);
    setLoadFailed(false);
    setSessionId(null);
    setSessionPublicId(null);
    setSessionTitle(null);
    treeRowsRef.current = [];
  }, [setSessionId, setSessionPublicId]);

  const clearChat = useCallback(() => {
    // Alias retained for legacy callers (page unmount cleanup). Same behavior as newSession.
    newSession();
  }, [newSession]);

  const loadSession = useCallback(
    async (publicId: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setError(null);
      setLoadFailed(false);
      setLoadingPhase("idle");
      setIsHydrating(true);

      const supabase = createClient();
      // Resolve the opaque public_id to the bigint id (RLS scopes to the owner).
      // `metadata.active_leaf_id` records which branch is currently active.
      const { data: session, error: sessErr } = await supabase
        .from("client_chat_sessions")
        .select("id, public_id, title, metadata")
        .eq("public_id", publicId)
        .maybeSingle();

      if (sessErr || !session) {
        setLoadFailed(true);
        setIsHydrating(false);
        return false;
      }

      setSessionTitle((session.title as string | null) ?? null);

      const { data, error: fetchErr } = await supabase
        .from("client_chat_messages")
        .select(
          "id, parent_id, role, content, sources, attachments, is_cancelled, created_at, reasoning, process_steps",
        )
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (fetchErr) {
        setError(`Failed to load session: ${fetchErr.message}`);
        setLoadFailed(true);
        setIsHydrating(false);
        return false;
      }

      // Messages form a parent/child tree (edit/regenerate create sibling
      // branches). Keep every row so the branch picker can reach siblings, but
      // display only the ACTIVE branch — the path from the active leaf to the root.
      const rows = (data ?? []) as MessageRow[];
      treeRowsRef.current = rows;
      const meta =
        session.metadata && typeof session.metadata === "object"
          ? (session.metadata as Record<string, unknown>)
          : {};
      const activeLeafId =
        typeof meta.active_leaf_id === "number" ? meta.active_leaf_id : null;
      const hydrated = buildActiveBranch(rows, activeLeafId);

      setMessages(hydrated);
      setAttachments([]);
      setLoadingAttachments([]);
      setLoadFailed(false);
      setSessionId(session.id);
      setSessionPublicId(session.public_id as string);
      setIsHydrating(false);
      return true;
    },
    [setSessionId, setSessionPublicId],
  );

  // Fetch the conversation list and populate the shared cache. Only hit the
  // network here — on first load, or when an actual change warrants a refresh —
  // not on every sidebar expand (callers read the cached `sessionList`).
  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("client_chat_sessions")
      .select("id, public_id, title, updated_at, project_id, pinned")
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (fetchErr) {
      setError(`Failed to list sessions: ${fetchErr.message}`);
      return [];
    }
    const list = (data ?? []) as SessionSummary[];
    setSessionList(list);
    sessionsLoadedRef.current = true;
    setSessionsLoaded(true);
    return list;
  }, []);

  // Backwards-compatible alias; both names fetch + refresh the cache.
  const listSessions = refreshSessions;

  const renameSession = useCallback(
    async (id: number, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!trimmed) return;
      // Optimistically update the cache so the UI reflects the change instantly.
      setSessionList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)),
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("client_chat_sessions")
        .update({ title: trimmed })
        .eq("id", id);
      if (updateErr) {
        setError(`Failed to rename conversation: ${updateErr.message}`);
        // Roll the optimistic edit back to the DB's truth.
        void refreshSessions();
      }
    },
    [refreshSessions],
  );

  const setPinned = useCallback(
    async (id: number, pinned: boolean): Promise<void> => {
      setSessionList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, pinned } : s)),
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("client_chat_sessions")
        .update({ pinned })
        .eq("id", id);
      if (updateErr) {
        setError(
          `Failed to ${pinned ? "pin" : "unpin"} conversation: ${updateErr.message}`,
        );
        void refreshSessions();
      }
    },
    [refreshSessions],
  );

  const deleteSession = useCallback(
    async (id: number): Promise<void> => {
      setSessionList((prev) => prev.filter((s) => s.id !== id));
      const supabase = createClient();
      // ON DELETE CASCADE on client_chat_messages.session_id removes the messages.
      const { error: delErr } = await supabase
        .from("client_chat_sessions")
        .delete()
        .eq("id", id);
      if (delErr) {
        setError(`Failed to delete conversation: ${delErr.message}`);
        // Restore the optimistically-removed row from the DB.
        void refreshSessions();
        return;
      }
      // If the deleted conversation was the open one, reset to a fresh session.
      if (sessionIdRef.current === id) newSession();
    },
    [newSession, refreshSessions],
  );

  // Keep the cache fresh when the active session changes (new chat created or
  // auto-titled) — but only once it's been loaded, so users who never open the
  // chat history never trigger a fetch. sessionId/sessionTitle are intentional
  // triggers, not values read in the effect body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh on session change
  useEffect(() => {
    if (sessionsLoadedRef.current) void refreshSessions();
  }, [sessionId, sessionTitle, refreshSessions]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessionId,
        sessionPublicId,
        sessionTitle,
        loadingPhase,
        isLoading,
        isStreaming,
        error,
        clearError,
        loadFailed,
        isHydrating,
        attachments,
        loadingAttachments,
        modelPreference,
        setModelPreference,
        sendMessage,
        retryLastMessage,
        addAttachment,
        removeAttachment,
        clearChat,
        cancelRequest,
        editAndResend,
        regenerateResponse,
        switchBranch,
        newSession,
        loadSession,
        listSessions,
        renameSession,
        setPinned,
        deleteSession,
        sessionList,
        sessionsLoaded,
        refreshSessions,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
