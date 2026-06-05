"use client";

import { CheckCircle2, Clock, Inbox } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import {
  btnGhost,
  DashboardShell,
  EmptyState,
  PageHeader,
  Panel,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import type { ResponseRow } from "@/lib/data/questionnaire";
import type { AnswerValue, FieldDef } from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";

interface ResponsesViewProps {
  title: string;
  rows: ResponseRow[];
}

export function ResponsesView({ title, rows }: ResponsesViewProps) {
  const [selected, setSelected] = useState<ResponseRow | null>(null);
  const submitted = rows.filter((r) => r.status === "submitted").length;
  const drafts = rows.filter((r) => r.status === "draft").length;

  return (
    <DashboardShell>
      <PageHeader
        title={`${title} — Responses`}
        subtitle={`${submitted} submitted · ${drafts} in progress`}
        action={
          <Link
            href="/dashboard/questionnaire/builder"
            className={cn(btnGhost, "h-9")}
          >
            Back
          </Link>
        }
      />

      <main className="flex-1 overflow-auto dashboard-scrollbar">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No responses yet"
            description="Once clients start filling out this form, their answers appear here."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6"
          >
            {/* List */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Submissions</SectionLabel>
              {rows.map((row) => (
                <button
                  key={row.submissionId}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                    selected?.submissionId === row.submissionId
                      ? "border-sbi-green/40 bg-sbi-green/5"
                      : "border-sbi-dark-border/40 bg-sbi-dark-card/30 hover:border-white/20",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {row.status === "submitted" ? (
                      <CheckCircle2 className="size-3.5 text-sbi-green" />
                    ) : (
                      <Clock className="size-3.5 text-amber-400" />
                    )}
                    <span className="text-xs text-white/85 font-mono truncate">
                      {row.userId.slice(0, 8)}…
                    </span>
                    <span className="ml-auto text-[10px] text-sbi-muted-dark">
                      v{row.schemaVersion}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-sbi-muted">
                    {row.status === "submitted"
                      ? `Submitted ${formatDate(row.submittedAt)}`
                      : `Draft · updated ${formatDate(row.updatedAt)}`}
                  </p>
                </button>
              ))}
            </div>

            {/* Detail */}
            <Panel>
              {selected ? (
                <ResponseDetail row={selected} />
              ) : (
                <p className="text-sm text-sbi-muted text-center py-12">
                  Select a submission to view its answers.
                </p>
              )}
            </Panel>
          </motion.div>
        )}
      </main>
    </DashboardShell>
  );
}

function ResponseDetail({ row }: { row: ResponseRow }) {
  const fields = row.fields;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-3 border-b border-sbi-dark-border/40">
        <span className="text-xs font-mono text-white/70">{row.userId}</span>
        <span
          className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded uppercase tracking-wide",
            row.status === "submitted"
              ? "bg-sbi-green/10 text-sbi-green"
              : "bg-amber-400/10 text-amber-400",
          )}
        >
          {row.status}
        </span>
      </div>
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.1em] text-sbi-muted">
            {field.label}
          </span>
          <span className="text-sm text-white/90">
            {formatAnswer(field, row.answers[field.id] ?? null)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatAnswer(field: FieldDef, value: AnswerValue): string {
  if (value === null || value === undefined || value === "") return "—";
  const labelFor = (v: string) =>
    field.options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map(labelFor).join(", ");
  }
  if (
    field.type === "radio" ||
    field.type === "dropdown" ||
    field.type === "checkboxes"
  ) {
    return labelFor(String(value));
  }
  return String(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
