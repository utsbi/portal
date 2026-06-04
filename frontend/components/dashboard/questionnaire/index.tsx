"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  DashboardShell,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
} from "@/components/dashboard/common/ui";
import { StatusPill } from "@/components/data-table/status-pill";
import type { QuestionnaireFormView } from "@/lib/data/questionnaire";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Form row
// ---------------------------------------------------------------------------

interface FormRowProps {
  form: QuestionnaireFormView;
  index: number;
  onOpen: (form: QuestionnaireFormView) => void;
}

function FormRow({ form, index, onOpen }: FormRowProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={() => onOpen(form)}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-all duration-200",
        "bg-transparent hover:bg-sbi-green/5 border border-transparent hover:border-sbi-dark-border/50",
        "group cursor-pointer",
      )}
    >
      {/* Form name + missing-required flag */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-white/90 group-hover:text-white transition-colors truncate">
          {form.title}
        </span>
        {form.missingRequired && (
          <AlertTriangle
            className="size-3.5 text-amber-400 shrink-0"
            strokeWidth={2}
          />
        )}
      </div>

      {/* Question count */}
      <span className="text-xs text-sbi-muted tabular-nums shrink-0 hidden sm:block">
        {form.questionCount}q
      </span>

      {/* Status */}
      <div className="shrink-0">
        <StatusPill status={form.status} />
      </div>

      {/* Arrow */}
      <ChevronRight
        className="size-4 text-sbi-muted/40 group-hover:text-sbi-green transition-colors shrink-0"
        strokeWidth={1.5}
      />
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer (right side panel) — renders the real form fields.
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  form: QuestionnaireFormView | null;
  onClose: () => void;
}

function DetailPanel({ form, onClose }: DetailPanelProps) {
  return (
    <AnimatePresence>
      {form && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed right-0 top-0 h-full w-full max-w-sm z-50",
              "bg-sbi-dark border-l border-sbi-dark-border/50 flex flex-col",
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-sbi-dark-border/40 shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted mb-1">
                  Questionnaire
                </p>
                <h2 className="text-lg font-light text-white leading-snug">
                  {form.title}
                </h2>
                {form.description && (
                  <p className="mt-2 text-xs text-sbi-muted leading-relaxed">
                    {form.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(btnGhost, "h-8 px-3 text-[10px] shrink-0")}
              >
                Close
              </button>
            </div>

            {/* Meta */}
            <div className="p-6 border-b border-sbi-dark-border/30 shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-sbi-muted mb-1.5">
                    Status
                  </p>
                  <StatusPill status={form.status} />
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-sbi-muted mb-1">
                    Questions
                  </p>
                  <p className="text-2xl font-thin text-white tabular-nums">
                    {form.questionCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-sbi-muted mb-1">
                    Required
                  </p>
                  {form.missingRequired ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                      <AlertTriangle className="size-3.5" strokeWidth={2} />
                      Missing fields
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sbi-green text-xs">
                      <CheckCircle2 className="size-3.5" strokeWidth={2} />
                      Complete
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Body — real form questions */}
            <div className="flex-1 overflow-y-auto p-6">
              <SectionLabel className="mb-4">Form Questions</SectionLabel>
              {form.fields.length === 0 ? (
                <p className="text-xs text-sbi-muted text-center py-8">
                  This form has no questions defined yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {form.fields.map((field, i) => (
                    <div
                      key={field.key}
                      className="rounded-lg bg-sbi-dark-card/40 border border-sbi-dark-border/30 px-4 py-3 flex items-start gap-3"
                    >
                      <span className="text-[10px] text-sbi-muted-dark tabular-nums w-4 shrink-0 pt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-white/90">
                            {field.label}
                          </span>
                          {field.required && (
                            <span className="text-amber-400 text-xs">*</span>
                          )}
                        </div>
                        {field.description && (
                          <p className="mt-0.5 text-xs text-sbi-muted leading-relaxed">
                            {field.description}
                          </p>
                        )}
                        <span className="mt-1.5 inline-block text-[10px] tracking-[0.1em] uppercase text-sbi-muted-dark">
                          {field.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-sbi-dark-border/30 shrink-0">
              <button
                type="button"
                className={cn(btnPrimary, "w-full")}
                disabled
              >
                Fill Out Form
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
  const [selectedForm, setSelectedForm] =
    useState<QuestionnaireFormView | null>(null);

  const stats = useMemo(() => {
    const total = forms.length;
    const done = forms.filter((f) => f.status === "Done").length;
    const inProcess = forms.filter((f) => f.status === "In Process").length;
    const needsAttention = forms.filter((f) => f.missingRequired).length;
    return { total, done, inProcess, needsAttention };
  }, [forms]);

  const subtitle =
    stats.total === 0
      ? "No questionnaire forms assigned yet"
      : `${stats.done} of ${stats.total} forms complete · ${stats.inProcess} in progress`;

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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-8"
          >
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatTile
                label="Total Forms"
                value={stats.total}
                sublabel="Assigned to this project"
                icon={<ClipboardList className="h-4 w-4" />}
              />
              <StatTile
                label="In Progress"
                value={stats.inProcess}
                sublabel="Awaiting your responses"
                icon={<Clock className="h-4 w-4" />}
              />
              <StatTile
                label="Complete"
                value={stats.done}
                sublabel="Submitted forms"
                tone="accent"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
            </div>

            {/* Needs attention banner */}
            {stats.needsAttention > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-400/5 border border-amber-400/20"
              >
                <AlertCircle
                  className="size-4 text-amber-400 shrink-0"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-amber-300">
                  <span className="font-medium">
                    {stats.needsAttention} form
                    {stats.needsAttention > 1 ? "s" : ""}
                  </span>{" "}
                  ha{stats.needsAttention > 1 ? "ve" : "s"} missing required
                  fields.
                </p>
              </motion.div>
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
                    onOpen={setSelectedForm}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Detail drawer */}
      <DetailPanel form={selectedForm} onClose={() => setSelectedForm(null)} />
    </DashboardShell>
  );
}
