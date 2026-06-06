"use client";

import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  DashboardShell,
  EmptyState,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { StatusPill } from "@/components/data-table/status-pill";
import type { QuestionnaireFormView } from "@/lib/data/questionnaire";
import { cn } from "@/lib/utils";

// "Not Started" isn't a StatusPill variant; surface it as a pending pill.
function pillStatus(status: QuestionnaireFormView["status"]): string {
  return status === "Not Started" ? "Pending" : status;
}

// ---------------------------------------------------------------------------
// Form row — links straight to the fill-out page (no intermediate preview).
// ---------------------------------------------------------------------------

interface FormRowProps {
  form: QuestionnaireFormView;
  index: number;
  reduce: boolean;
}

function FormRow({ form, index, reduce }: FormRowProps) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        delay: reduce ? 0 : index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={`/dashboard/questionnaire/${form.id}`}
        className={cn(
          "w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-all duration-200 group cursor-pointer",
          "bg-transparent hover:bg-sbi-green/5 border border-transparent hover:border-sbi-dark-border/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green/50",
        )}
      >
        {/* Form name + missing-required flag */}
        <span className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm text-white/90 group-hover:text-white transition-colors truncate">
            {form.title}
          </span>
          {form.missingRequired && (
            <AlertTriangle
              className="size-3.5 text-amber-400 shrink-0"
              strokeWidth={2}
            />
          )}
        </span>

        {/* Question count */}
        <span className="text-xs text-sbi-muted tabular-nums shrink-0 hidden sm:block">
          {form.questionCount}q
        </span>

        {/* Status */}
        <span className="shrink-0">
          <StatusPill status={pillStatus(form.status)} />
        </span>

        <ChevronRight
          className="size-4 text-sbi-muted/40 group-hover:text-sbi-green transition-colors shrink-0"
          strokeWidth={1.5}
        />
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

interface QuestionnaireViewProps {
  projectId: number;
  forms: QuestionnaireFormView[];
}

export function QuestionnaireView({ forms }: QuestionnaireViewProps) {
  const reduce = useReducedMotion() ?? false;

  const total = forms.length;
  const done = forms.filter((f) => f.status === "Done").length;
  const inProcess = forms.filter((f) => f.status === "In Process").length;
  const needsAttention = forms.filter((f) => f.missingRequired).length;

  const subtitle =
    total === 0
      ? "No questionnaire forms assigned yet"
      : `${done} of ${total} complete${inProcess > 0 ? ` · ${inProcess} in progress` : ""}`;

  return (
    <DashboardShell>
      <PageHeader title="Questionnaire" subtitle={subtitle} />

      <main className="flex-1 overflow-auto dashboard-scrollbar">
        {forms.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No questionnaires yet"
            description="Your project team will assign intake forms here when they're ready."
          />
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            {/* Needs attention banner */}
            {needsAttention > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
                <AlertCircle
                  className="size-4 text-amber-400 shrink-0"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-amber-300">
                  <span className="font-medium">
                    {needsAttention} form{needsAttention > 1 ? "s" : ""}
                  </span>{" "}
                  ha{needsAttention > 1 ? "ve" : "s"} missing required fields.
                </p>
              </div>
            )}

            {/* Forms list */}
            <div>
              <SectionLabel>Assigned Forms</SectionLabel>
              <div className="bg-sbi-dark-card/30 border border-sbi-dark-border/40 rounded-xl p-2 space-y-0.5">
                {forms.map((form, i) => (
                  <FormRow
                    key={form.id}
                    form={form}
                    index={i}
                    reduce={reduce}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </DashboardShell>
  );
}
