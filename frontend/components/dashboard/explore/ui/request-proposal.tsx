"use client";

import { Check, Send, X } from "lucide-react";
import { useState } from "react";
import { createTicketRequest } from "@/app/dashboard/requests/actions";
import type { TimelineStep } from "@/lib/chat/chat-context";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";

export interface RequestProposal {
  subject: string;
  message: string;
}

// create_request embeds its draft on a `PROPOSAL_JSON:` line in the tool result
// text; nothing is written server-side until the user confirms the card. A
// malformed payload yields null (no card).
export function parseRequestProposal(text?: string): RequestProposal | null {
  const line = text?.split("\n").find((l) => l.startsWith("PROPOSAL_JSON:"));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line.slice("PROPOSAL_JSON:".length));
    if (
      parsed?.kind === "request_proposal" &&
      typeof parsed.subject === "string" &&
      typeof parsed.message === "string"
    ) {
      return { subject: parsed.subject, message: parsed.message };
    }
  } catch {
    // fall through to null
  }
  return null;
}

// Pull the drafted request (if any) from a turn's completed create_request step.
export function getRequestProposal(
  steps: TimelineStep[],
): RequestProposal | null {
  for (const step of steps) {
    if (
      step.kind === "tool" &&
      step.toolName === "create_request" &&
      step.state === "done"
    ) {
      const proposal = parseRequestProposal(step.output?.text);
      if (proposal) return proposal;
    }
  }
  return null;
}

/**
 * Draft-request confirmation card, rendered in the MAIN chat (not the process
 * timeline). Confirm runs the same membership-gated `createTicketRequest` action
 * as the Requests page; Deny dismisses the draft. Nothing is written until the
 * user confirms — the assistant only ever produced a draft.
 */
export function RequestProposalCard({
  proposal,
}: {
  proposal: RequestProposal;
}) {
  const { user, activeProject } = useProject();
  const [state, setState] = useState<
    "idle" | "submitting" | "submitted" | "denied"
  >("idle");
  const projectId = activeProject?.projectId ?? null;
  const canSubmit = projectId !== null && !!user;

  const handleConfirm = async () => {
    if (!canSubmit || state !== "idle" || projectId === null || !user) return;
    setState("submitting");
    const result = await createTicketRequest({
      projectId,
      name: user.name,
      email: user.email,
      subject: proposal.subject,
      message: proposal.message,
    });
    if (result.error !== null) {
      setState("idle");
      toastError(result.error, "Request not submitted");
      return;
    }
    setState("submitted");
    toastSuccess(
      "Your team will see it on the Requests page.",
      "Request submitted",
    );
  };

  if (state === "denied") return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-sbi-dark-border bg-sbi-dark-card/50">
      <div className="flex items-center gap-2 border-b border-sbi-dark-border px-4 py-2.5">
        <Send className="size-3.5 text-sbi-green" strokeWidth={1.5} />
        <span className="text-sm font-medium text-white/90">Draft request</span>
        {state !== "submitted" && (
          <span className="ml-auto text-[11px] font-light text-sbi-muted-dark">
            Nothing is sent until you confirm
          </span>
        )}
      </div>

      <div className="space-y-1.5 px-4 py-3">
        <div className="text-sm font-medium text-white">{proposal.subject}</div>
        <p className="whitespace-pre-wrap break-words text-sm font-light leading-relaxed text-sbi-muted">
          {proposal.message}
        </p>
      </div>

      <div className="border-t border-sbi-dark-border px-4 py-3">
        {state === "submitted" ? (
          <div className="flex items-center gap-1.5 text-sm font-medium text-sbi-green">
            <Check className="size-4" strokeWidth={2} />
            Request submitted
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canSubmit || state === "submitting"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sbi-green/40 bg-sbi-green/15 px-3 py-1.5 text-sm font-medium text-sbi-green transition-colors hover:bg-sbi-green/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "submitting" ? (
                <span className="size-3.5 animate-spin rounded-full border border-sbi-green/40 border-t-sbi-green/90" />
              ) : (
                <Send className="size-3.5" strokeWidth={1.5} />
              )}
              Confirm &amp; submit
            </button>
            <button
              type="button"
              onClick={() => setState("denied")}
              disabled={state === "submitting"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sbi-dark-border bg-sbi-dark-card px-3 py-1.5 text-sm font-medium text-sbi-muted transition-colors hover:text-white disabled:opacity-50"
            >
              <X className="size-3.5" strokeWidth={1.5} />
              Deny
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
