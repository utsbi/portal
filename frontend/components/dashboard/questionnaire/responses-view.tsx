"use client";

import {
  CheckCircle2,
  Clock,
  Download,
  Inbox,
  Loader2,
  Paperclip,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
import {
  createAttachmentSignedUrl,
  fileNameFromPath,
} from "@/lib/questionnaire/file-upload";
import {
  type AnswerValue,
  type FieldDef,
  type FormSchema,
  isAnswered,
} from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";

interface ResponsesViewProps {
  title: string;
  schema: FormSchema;
  rows: ResponseRow[];
}

type ResponsesTab = "list" | "summary";

export function ResponsesView({ title, schema, rows }: ResponsesViewProps) {
  const reduce = useReducedMotion() ?? false;
  const [selected, setSelected] = useState<ResponseRow | null>(null);
  const [tab, setTab] = useState<ResponsesTab>("list");
  const submitted = rows.filter((r) => r.status === "submitted").length;
  const drafts = rows.filter((r) => r.status === "draft").length;

  return (
    <DashboardShell>
      <PageHeader
        title={title}
        subtitle={`Responses · ${submitted} submitted · ${drafts} in progress`}
        action={
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <div className="flex rounded-md border border-sbi-dark-border/60 p-0.5">
                {(["list", "summary"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "px-3 h-8 rounded text-[11px] uppercase tracking-[0.04em] transition-colors",
                      tab === t
                        ? "bg-sbi-green/10 text-sbi-green"
                        : "text-sbi-muted hover:text-white",
                    )}
                  >
                    {t === "list" ? "Submissions" : "Summary"}
                  </button>
                ))}
              </div>
            )}
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => exportResponsesCsv(title, rows)}
                className={cn(btnGhost, "h-9")}
              >
                <Download className="size-4" /> Export CSV
              </button>
            )}
            <Link
              href="/dashboard/questionnaire/builder"
              className={cn(btnGhost, "h-9")}
            >
              Back
            </Link>
          </div>
        }
      />

      <main className="flex-1 overflow-auto dashboard-scrollbar">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No responses yet"
            description="Once clients start filling out this form, their answers appear here."
          />
        ) : tab === "summary" ? (
          <ResponsesSummary schema={schema} rows={rows} reduce={reduce} />
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            <SectionLabel>Submissions</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
              {/* List */}
              <div className="flex flex-col gap-2">
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
                      <span className="text-xs text-white/85 truncate">
                        {responderLabel(row)}
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
            </div>
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
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-white/85 truncate">
            {responderLabel(row)}
          </span>
          {row.userEmail && row.userName && (
            <span className="text-[11px] text-sbi-muted truncate">
              {row.userEmail}
            </span>
          )}
        </div>
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
      {fields.map((field) => {
        const value = row.answers[field.id] ?? null;
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.1em] text-sbi-muted">
              {field.label}
            </span>
            {field.type === "file" && typeof value === "string" && value ? (
              <FileAnswer path={value} />
            ) : (
              <span className="text-sm text-white/90">
                {formatAnswer(field, value)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileAnswer({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    setError(false);
    const url = await createAttachmentSignedUrl(path);
    setLoading(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 self-start rounded-md border border-sbi-dark-border/50 bg-sbi-dark-card px-3 py-1.5 text-sm text-white/85 transition-colors hover:border-sbi-green/40 hover:text-sbi-green disabled:opacity-50"
      >
        <Paperclip className="size-3.5 shrink-0" />
        <span className="max-w-xs truncate">{fileNameFromPath(path)}</span>
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
      </button>
      {error && (
        <span className="text-xs text-red-400">
          Couldn't open the file. Try again.
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary / analytics — per-question aggregates over SUBMITTED responses.
// ---------------------------------------------------------------------------

function ResponsesSummary({
  schema,
  rows,
  reduce,
}: {
  schema: FormSchema;
  rows: ResponseRow[];
  reduce: boolean;
}) {
  const submittedRows = rows.filter((r) => r.status === "submitted");
  const total = submittedRows.length;
  const answerable = schema.fields.filter((f) => f.type !== "section");

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 max-w-3xl"
    >
      <SectionLabel>{`Summary · ${total} submitted`}</SectionLabel>
      {total === 0 ? (
        <p className="text-sm text-sbi-muted">No submitted responses yet.</p>
      ) : answerable.length === 0 ? (
        <p className="text-sm text-sbi-muted">This form has no questions.</p>
      ) : (
        answerable.map((field) => (
          <Panel key={field.id} className="flex flex-col gap-3">
            <span className="text-sm text-white/90">{field.label}</span>
            <FieldSummary field={field} rows={submittedRows} total={total} />
          </Panel>
        ))
      )}
    </motion.div>
  );
}

function Bar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-white/80 truncate">{label}</span>
        <span className="text-sbi-muted tabular-nums shrink-0">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-sbi-dark-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-sbi-green/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function toNumber(v: AnswerValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function FieldSummary({
  field,
  rows,
  total,
}: {
  field: FieldDef;
  rows: ResponseRow[];
  total: number;
}) {
  const labelFor = (v: string) =>
    field.options?.find((o) => o.value === v)?.label ?? v;

  if (
    field.type === "radio" ||
    field.type === "dropdown" ||
    field.type === "checkboxes"
  ) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r.answers[field.id];
      if (Array.isArray(v)) {
        for (const item of v) counts.set(item, (counts.get(item) ?? 0) + 1);
      } else if (typeof v === "string" && v) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    const options = field.options ?? [];
    const seen = new Set(options.map((o) => o.value));
    const extras = [...counts.keys()].filter((k) => !seen.has(k));
    return (
      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <Bar
            key={o.value}
            label={o.label}
            count={counts.get(o.value) ?? 0}
            total={total}
          />
        ))}
        {extras.map((k) => (
          <Bar
            key={k}
            label={labelFor(k)}
            count={counts.get(k) ?? 0}
            total={total}
          />
        ))}
      </div>
    );
  }

  if (field.type === "scale" || field.type === "number") {
    const nums = rows
      .map((r) => toNumber(r.answers[field.id] ?? null))
      .filter((n): n is number => n !== null);
    if (nums.length === 0) {
      return <p className="text-xs text-sbi-muted-dark">No answers yet.</p>;
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return (
      <div className="flex flex-wrap gap-6 text-sm">
        <Stat label="Average" value={avg.toFixed(1)} />
        <Stat label="Min" value={String(min)} />
        <Stat label="Max" value={String(max)} />
        <Stat label="Answered" value={`${nums.length} of ${total}`} />
      </div>
    );
  }

  // Free-text / date / time / file: just a response rate.
  const answered = rows.filter((r) =>
    isAnswered(r.answers[field.id] ?? null),
  ).length;
  return (
    <p className="text-xs text-sbi-muted">
      <span className="text-white/85 tabular-nums">{answered}</span> of {total}{" "}
      answered
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark">
        {label}
      </span>
      <span className="text-white/90 tabular-nums">{value}</span>
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

/** Best display name for a responder: name → email → shortened uid. */
function responderLabel(row: ResponseRow): string {
  if (row.userName) return row.userName;
  if (row.userEmail) return row.userEmail;
  return row.userId ? `${row.userId.slice(0, 8)}…` : "Anonymous";
}

// ---------------------------------------------------------------------------
// CSV export — one row per submission, one column per answerable field (union
// across all rows, first-seen order). File answers export as their filename.
// ---------------------------------------------------------------------------

function csvCell(field: FieldDef, value: AnswerValue): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "file" && typeof value === "string") {
    return fileNameFromPath(value);
  }
  return formatAnswer(field, value);
}

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function exportResponsesCsv(title: string, rows: ResponseRow[]): void {
  const columns: FieldDef[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const field of row.fields) {
      if (!seen.has(field.id)) {
        seen.add(field.id);
        columns.push(field);
      }
    }
  }

  const header = [
    "Responder",
    "Email",
    "Status",
    "Submitted",
    "Updated",
    "Schema version",
    ...columns.map((c) => c.label),
  ];

  const body = rows.map((row) => [
    row.userName ?? row.userId ?? "Anonymous",
    row.userEmail ?? "",
    row.status,
    row.submittedAt ?? "",
    row.updatedAt ?? "",
    String(row.schemaVersion),
    ...columns.map((c) => csvCell(c, row.answers[c.id] ?? null)),
  ]);

  const csv = [header, ...body]
    .map((line) => line.map(escapeCsv).join(","))
    .join("\r\n");

  const slug =
    title
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "") || "form";
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug}-responses.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
