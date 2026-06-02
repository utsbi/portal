"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FormPriority = "Critical" | "High" | "Medium" | "Low";
export type FormStatus = "In Process" | "Done";

export interface QuestionnaireForm {
  id: number;
  formName: string;
  priority: FormPriority;
  questionCount: number;
  team: string;
  status: FormStatus;
  missingRequired: boolean;
}

// ---------------------------------------------------------------------------
// Mock data (matches table-comparison prototype)
// TODO: Replace with Supabase query once questionnaire_templates table is added
// via migration. See feat/schema-migrations worktree coordination note.
// ---------------------------------------------------------------------------

const MOCK_FORMS: QuestionnaireForm[] = [
  {
    id: 1,
    formName: "General Form",
    priority: "High",
    questionCount: 8,
    team: "Architecture",
    status: "In Process",
    missingRequired: true,
  },
  {
    id: 2,
    formName: "Conceptual Basics",
    priority: "Critical",
    questionCount: 5,
    team: "Architecture",
    status: "Done",
    missingRequired: false,
  },
  {
    id: 3,
    formName: "Interior Detail",
    priority: "High",
    questionCount: 6,
    team: "Architecture",
    status: "In Process",
    missingRequired: false,
  },
  {
    id: 4,
    formName: "Architecture & Aesthetic",
    priority: "Medium",
    questionCount: 5,
    team: "Architecture",
    status: "Done",
    missingRequired: false,
  },
  {
    id: 5,
    formName: "The Estate",
    priority: "Medium",
    questionCount: 7,
    team: "Architecture",
    status: "In Process",
    missingRequired: true,
  },
  {
    id: 6,
    formName: "Pool Specifications",
    priority: "High",
    questionCount: 3,
    team: "Architecture",
    status: "In Process",
    missingRequired: false,
  },
  {
    id: 7,
    formName: "Pool - Civil Engineering",
    priority: "Medium",
    questionCount: 2,
    team: "Engineering",
    status: "Done",
    missingRequired: false,
  },
  {
    id: 8,
    formName: "Pool - Mechanical Systems",
    priority: "Medium",
    questionCount: 2,
    team: "Engineering",
    status: "In Process",
    missingRequired: false,
  },
  {
    id: 9,
    formName: "Pool - Finance",
    priority: "Low",
    questionCount: 1,
    team: "Finance",
    status: "Done",
    missingRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<FormPriority, string> = {
  Critical: "text-red-300 bg-red-500/10 border border-red-500/30",
  High: "text-amber-300 bg-amber-400/10 border border-amber-400/20",
  Medium: "text-blue-300 bg-blue-400/10 border border-blue-400/20",
  Low: "text-sbi-muted bg-white/5 border border-white/10",
};

const PRIORITY_ORDER: Record<FormPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function PriorityBadge({ priority }: { priority: FormPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase whitespace-nowrap",
        PRIORITY_STYLES[priority],
      )}
    >
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form row inside a team group
// ---------------------------------------------------------------------------

interface FormRowProps {
  form: QuestionnaireForm;
  index: number;
  onOpen: (form: QuestionnaireForm) => void;
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
          {form.formName}
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

      {/* Priority */}
      <div className="shrink-0 hidden md:block">
        <PriorityBadge priority={form.priority} />
      </div>

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
// Team group (collapsible)
// ---------------------------------------------------------------------------

interface TeamGroupProps {
  team: string;
  forms: QuestionnaireForm[];
  defaultOpen?: boolean;
  onOpen: (form: QuestionnaireForm) => void;
}

function TeamGroup({
  team,
  forms,
  defaultOpen = true,
  onOpen,
}: TeamGroupProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  const doneCount = forms.filter((f) => f.status === "Done").length;
  const totalCount = forms.length;
  const allDone = doneCount === totalCount;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="bg-sbi-dark-card/30 border border-sbi-dark-border/40 rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-sbi-green/5 transition-colors cursor-pointer"
      >
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs font-medium tracking-[0.15em] uppercase text-sbi-muted">
            {team}
          </span>
          <span className="text-[10px] text-sbi-muted-dark tabular-nums">
            {doneCount}/{totalCount}
          </span>
          {/* Progress bar */}
          <div className="flex-1 h-px bg-sbi-dark-border/50 max-w-[80px] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allDone ? "bg-sbi-green" : "bg-sbi-green/40",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {allDone && (
          <CheckCircle2
            className="size-4 text-sbi-green shrink-0"
            strokeWidth={1.5}
          />
        )}
        <ChevronDown
          className={cn(
            "size-4 text-sbi-muted/50 transition-transform duration-200 shrink-0",
            expanded ? "" : "-rotate-90",
          )}
          strokeWidth={1.5}
        />
      </button>

      {/* Rows */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-sbi-dark-border/30"
          >
            <div className="p-2 space-y-0.5">
              {forms
                .slice()
                .sort(
                  (a, b) =>
                    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
                )
                .map((form, i) => (
                  <FormRow
                    key={form.id}
                    form={form}
                    index={i}
                    onOpen={onOpen}
                  />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer (right side panel)
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  form: QuestionnaireForm | null;
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
                  {form.team}
                </p>
                <h2 className="text-lg font-light text-white leading-snug">
                  {form.formName}
                </h2>
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
                  <p className="text-[10px] tracking-[0.15em] uppercase text-sbi-muted mb-1.5">
                    Priority
                  </p>
                  <PriorityBadge priority={form.priority} />
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

            {/* Body placeholder */}
            <div className="flex-1 overflow-y-auto p-6">
              <SectionLabel className="mb-4">Form Questions</SectionLabel>
              <div className="space-y-3">
                {Array.from({ length: form.questionCount }).map((_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
                    key={i}
                    className="h-16 rounded-lg bg-sbi-dark-card/40 border border-sbi-dark-border/30 flex items-center px-4 gap-3"
                  >
                    <span className="text-[10px] text-sbi-muted-dark tabular-nums w-4 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2 bg-sbi-dark-border/50 rounded-full w-3/4" />
                      <div className="h-1.5 bg-sbi-dark-border/30 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-sbi-muted text-center">
                Form content requires questionnaire_templates table.
                <br />
                See coordination note in feat/schema-migrations.
              </p>
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

export function QuestionnaireView() {
  const [selectedForm, setSelectedForm] = useState<QuestionnaireForm | null>(
    null,
  );

  const forms = MOCK_FORMS;

  const stats = useMemo(() => {
    const total = forms.length;
    const done = forms.filter((f) => f.status === "Done").length;
    const inProcess = forms.filter((f) => f.status === "In Process").length;
    const needsAttention = forms.filter((f) => f.missingRequired).length;
    return { total, done, inProcess, needsAttention };
  }, [forms]);

  // Group by team, preserving insertion order
  const grouped = useMemo(() => {
    const map = new Map<string, QuestionnaireForm[]>();
    for (const form of forms) {
      if (!map.has(form.team)) map.set(form.team, []);
      map.get(form.team)?.push(form);
    }
    return Array.from(map.entries());
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

            {/* Team groups */}
            <div>
              <SectionLabel>Forms by Team</SectionLabel>
              <div className="space-y-3">
                {grouped.map(([team, teamForms]) => (
                  <TeamGroup
                    key={team}
                    team={team}
                    forms={teamForms}
                    defaultOpen
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
