"use client";

import {
  Check,
  ChevronDown,
  Clock,
  FileText,
  Search,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineStep, ToolStepOutput } from "@/lib/chat/chat-context";
import { cn } from "@/lib/utils";
import { getFileInfo } from "./file-info";

// Claude-research-style "process timeline": a collapsible summary header over a
// left rail whose icons mark each step — clock for reasoning, a tool glyph per
// tool call, a check for "Done". Driven by the ordered TimelineStep[] streamed
// onto an assistant turn (reasoning interleaved with tool calls). Ephemeral:
// steps are not persisted, so the timeline appears on live turns only.

const partTransition = { duration: 0.2, ease: "easeOut" } as const;

const TOOL_LABELS: Record<string, string> = {
  search_documents: "Searched documents",
  search_sbi_knowledge: "Searched SBI knowledge",
  get_reports: "Fetched reports",
  get_finance_summary: "Fetched finances",
  get_lifecycle_status: "Checked project status",
  get_questionnaire_status: "Checked questionnaires",
  get_requests: "Fetched requests",
  get_upcoming_events: "Checked calendar",
  create_request: "Drafted a request",
};

function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

// Search-style tools get the magnifier; record/report fetches get the document.
function isFetchTool(toolName: string): boolean {
  return (
    toolName === "get_reports" ||
    toolName === "get_finance_summary" ||
    toolName === "get_lifecycle_status"
  );
}

interface ToolCardProps {
  toolName: string;
  done: boolean;
  output?: ToolStepOutput;
}

// Tool card — echoes the Sources panel row language (numbered green badge, file
// icon, filename · page) but lighter than the answer, so the timeline reads
// thinking → tool card → answer. The rail already carries the tool glyph, so the
// card header has no leading icon (avoids a double-glyph stutter).
function ToolCard({ toolName, done, output }: ToolCardProps) {
  const label = toolLabel(toolName);
  const sources = output?.sources ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-sbi-dark-border bg-sbi-dark-card/40">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="text-[13px] font-light text-white/90">{label}</span>
        {!done ? (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-light text-sbi-muted">
            <span className="size-3 animate-spin rounded-full border border-sbi-green/40 border-t-sbi-green/90" />
            Running…
          </span>
        ) : sources.length > 0 ? (
          <span className="ml-auto rounded-md border border-sbi-green/30 bg-sbi-green/10 px-1.5 py-0.5 text-[11px] font-medium text-sbi-green/90">
            {sources.length} result{sources.length === 1 ? "" : "s"}
          </span>
        ) : !output?.text ? (
          <span className="ml-auto rounded-md border border-sbi-dark-border bg-sbi-dark-card px-1.5 py-0.5 text-[11px] font-medium text-sbi-muted">
            No results
          </span>
        ) : null}
      </div>

      {done && sources.length > 0 && (
        <div className="space-y-0.5 border-t border-sbi-dark-border px-2 py-1.5">
          {sources.map((s, i) => {
            const filename = s.filename ?? "Untitled";
            const fileInfo = getFileInfo(filename);
            const name = filename.replace(/\.[^/.]+$/, "");
            return (
              <div
                key={`${filename}-${s.page_number ?? ""}-${i}`}
                className="flex items-center gap-2.5 px-2 py-1.5"
              >
                <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-md border border-sbi-green/30 bg-sbi-green/10 px-1 text-[11px] font-medium text-sbi-green/90">
                  {i + 1}
                </span>
                {fileInfo.icon}
                <span className="truncate text-[13px] text-white/90">
                  {name}
                  {typeof s.page_number === "number" && (
                    <span className="text-sbi-muted-dark">
                      {" "}
                      · p. {s.page_number}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* create_request's draft renders as a confirm/deny card in the main chat
          (see request-proposal.tsx), so its raw PROPOSAL_JSON text is suppressed
          here. Other tools show a short text summary. */}
      {done &&
        sources.length === 0 &&
        output?.text &&
        toolName !== "create_request" && (
          <div className="border-t border-sbi-dark-border px-3 py-2 text-[13px] font-light leading-snug text-sbi-muted">
            {output.text.slice(0, 300)}
            {output.text.length > 300 ? "…" : ""}
          </div>
        )}
    </div>
  );
}

// The icon that sits on the timeline rail for a given step.
function StepIcon({ step }: { step: TimelineStep }) {
  if (step.kind === "tool") {
    return isFetchTool(step.toolName) ? (
      <FileText className="size-3.5 text-sbi-green/80" strokeWidth={1.5} />
    ) : (
      <Search className="size-3.5 text-sbi-green/80" strokeWidth={1.5} />
    );
  }
  return <Clock className="size-3.5 text-sbi-muted" strokeWidth={1.5} />;
}

// Reasoning text — compact and de-emphasized, clamped to a few lines once the
// turn settles (with a Show more/less toggle). While the turn is still streaming
// it stays fully expanded so the user can watch it think.
function ReasoningText({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  // Collapse the model's generous blank-line gaps so the rail stays tight.
  const normalized = useMemo(
    () => text.replace(/\n{2,}/g, "\n").trim(),
    [text],
  );
  const clamped = !streaming && !expanded;

  // `normalized` is an intentional re-measure trigger (re-check overflow as the
  // reasoning text grows mid-stream), not read in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure on text growth
  useEffect(() => {
    if (!clamped) return;
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [normalized, clamped]);

  return (
    <div>
      <p
        ref={ref}
        className={cn(
          "whitespace-pre-wrap break-words text-[13px] font-light leading-snug text-sbi-muted",
          clamped && "line-clamp-3",
        )}
      >
        {normalized}
      </p>
      {!streaming && (overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[12px] font-light text-sbi-green/80 transition-colors hover:text-sbi-green"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

interface ProcessTimelineProps {
  steps: TimelineStep[];
  streaming: boolean;
  done: boolean;
  title?: string | null;
}

export function ProcessTimeline({
  steps,
  streaming,
  done,
  title,
}: ProcessTimelineProps) {
  // Open while the turn is live; auto-collapse once it settles so a long
  // transcript doesn't keep every past turn's reasoning expanded. The user can
  // still re-open any card (the effect only fires on the settle transition).
  const [open, setOpen] = useState(streaming);
  useEffect(() => {
    if (done && !streaming) setOpen(false);
  }, [done, streaming]);

  const headerLabel =
    title ?? (streaming && !done ? "Working through it…" : "Worked through it");

  // Build a uniform row list (steps + a trailing "Done") so the rail connector
  // can be drawn per-row and simply omitted after the last row — this is what
  // makes the line terminate at the check instead of running through it.
  const rows: {
    key: string;
    kind: "reasoning" | "tool" | "done";
    icon: ReactNode;
    content: ReactNode;
    // Key by array index — steps are append-only and never reordered, so the
    // index is stable AND unique even if a tool id collides (see backend
    // fallback id). The kind/id suffix is just for readability in the DOM.
  }[] = steps.map((step, i) => ({
    key: `${i}-${step.kind === "tool" ? step.toolCallId : "reasoning"}`,
    kind: step.kind,
    icon: <StepIcon step={step} />,
    content:
      step.kind === "reasoning" ? (
        <ReasoningText text={step.text} streaming={streaming} />
      ) : (
        <ToolCard
          toolName={step.toolName}
          done={step.state === "done"}
          output={step.output}
        />
      ),
  }));
  if (done) {
    rows.push({
      key: "done",
      kind: "done",
      icon: <Check className="size-3.5 text-sbi-green" strokeWidth={2} />,
      content: <span className="text-sm font-light text-sbi-green">Done</span>,
    });
  }

  return (
    <div className="rounded-xl border border-sbi-dark-border bg-sbi-dark-card/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {streaming && !done ? (
          <span className="size-3.5 shrink-0 animate-spin rounded-full border border-sbi-green/40 border-t-sbi-green/90" />
        ) : (
          // Neutral glyph (not a check) — the rail's "Done" step is the sole
          // completion cue, so the header doesn't double up on checkmarks.
          <Sparkles
            className="size-3.5 shrink-0 text-sbi-green/70"
            strokeWidth={1.5}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-light text-white/90">
          {headerLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-sbi-muted transition-transform duration-200",
            open && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="border-t border-sbi-dark-border px-3 py-3">
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            return (
              <motion.div
                key={row.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={partTransition}
                className="flex gap-3"
              >
                {/* Icon + downward connector. The connector flex-fills to the
                    bottom of the row (incl. the content's pb) so it meets the
                    next icon; the last row omits it, capping the rail. */}
                <div className="flex flex-col items-center self-stretch">
                  <div
                    className={cn(
                      "flex size-[21px] shrink-0 items-center justify-center rounded-full border",
                      row.kind === "done"
                        ? "border-sbi-green/30 bg-sbi-green/10"
                        : "border-sbi-dark-border bg-sbi-dark",
                    )}
                  >
                    {row.icon}
                  </div>
                  {!isLast && (
                    <div className="mt-1 w-px flex-1 bg-sbi-dark-border" />
                  )}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    // The single-line "Done" row centers against its check;
                    // multi-line step content top-aligns with its icon.
                    row.kind === "done"
                      ? "flex min-h-[21px] items-center"
                      : "pt-0.5",
                    !isLast && "pb-3",
                  )}
                >
                  {row.content}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
