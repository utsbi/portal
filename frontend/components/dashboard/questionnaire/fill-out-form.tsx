"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isActionError } from "@/app/dashboard/questionnaire/action-types";
import { saveDraft, submitForm } from "@/app/dashboard/questionnaire/actions";
import {
  btnGhost,
  btnPrimary,
  DashboardShell,
  PageHeader,
  Panel,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toastError, toastSuccess } from "@/lib/notifications";
import {
  type AnswerMap,
  type AnswerValue,
  type FieldDef,
  type FormSchema,
  formWindowState,
  isAnswered,
  isFieldVisible,
  validateAnswers,
} from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";
import { FieldRenderer } from "./field-renderer";

interface FillOutFormProps {
  formId: number;
  projectId: number;
  title: string;
  description: string | null;
  schema: FormSchema;
  initialAnswers: AnswerMap;
  initialStatus: "draft" | "submitted" | null;
  opensAt: string | null;
  closesAt: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function FillOutForm({
  formId,
  projectId,
  title,
  description,
  schema,
  initialAnswers,
  initialStatus,
  opensAt,
  closesAt,
}: FillOutFormProps) {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const windowState = formWindowState(opensAt, closesAt);
  const closed = windowState !== "open";
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialStatus === "submitted");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDraft = useCallback(
    async (next: AnswerMap) => {
      setSaveState("saving");
      const res = await saveDraft({ formId, projectId, answers: next });
      if (isActionError(res)) {
        setSaveState("error");
      } else {
        setSaveState("saved");
      }
    },
    [formId, projectId],
  );

  // Debounced autosave whenever answers change (only after a user edit).
  useEffect(() => {
    if (!dirtyRef.current || submitted) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persistDraft(answers);
    }, 900);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [answers, persistDraft, submitted]);

  const setAnswer = (fieldId: string, value: AnswerValue) => {
    dirtyRef.current = true;
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  // Validate first; only open the confirm step once the form is actually valid.
  const handleSubmit = () => {
    const validationErrors = validateAnswers(schema, answers);
    if (validationErrors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of validationErrors) map[e.fieldId] = e.message;
      setErrors(map);
      toastError(
        `Please complete ${validationErrors.length} required or invalid field${
          validationErrors.length > 1 ? "s" : ""
        }.`,
      );
      return;
    }
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    setSubmitting(true);
    const res = await submitForm({ formId, projectId, answers });
    setSubmitting(false);
    setConfirmOpen(false);
    if (isActionError(res)) {
      toastError(res.error);
      return;
    }
    setSubmitted(true);
    toastSuccess("Form submitted. Thank you!");
    router.refresh();
  };

  // Group fields into sections for rendering. A leading run before any section
  // divider forms an implicit first section.
  const groups = groupBySection(schema.fields);

  // Progress over currently-visible answerable fields (respects conditional logic).
  const visibleAnswerable = schema.fields.filter(
    (f) => f.type !== "section" && isFieldVisible(f, answers),
  );
  const answeredCount = visibleAnswerable.filter((f) =>
    isAnswered(answers[f.id] ?? null),
  ).length;

  return (
    <DashboardShell>
      <PageHeader
        title={title}
        subtitle={description ?? "Complete the questions below."}
        action={
          <Link href="/dashboard/questionnaire" className={cn(btnGhost, "h-9")}>
            Back
          </Link>
        }
      />

      <main className="flex-1 overflow-auto dashboard-scrollbar pb-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6 max-w-2xl"
        >
          {submitted && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sbi-green/5 border border-sbi-green/20">
              <CheckCircle2 className="size-4 text-sbi-green shrink-0" />
              <p className="text-sm text-sbi-green/90">
                This form has been submitted. You can review your answers below.
              </p>
            </div>
          )}

          {!submitted && closed && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
              <AlertCircle className="size-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                {windowState === "not_yet"
                  ? "This form isn't open yet, so it can't be submitted."
                  : "This form is closed and no longer accepting responses."}
              </p>
            </div>
          )}

          {groups.map((group, gi) => (
            <Panel key={group.key} className="flex flex-col gap-5">
              {group.section ? (
                <div>
                  <SectionLabel>{group.section.label}</SectionLabel>
                  {group.section.description && (
                    <p className="text-xs text-sbi-muted -mt-3 mb-1">
                      {group.section.description}
                    </p>
                  )}
                </div>
              ) : gi === 0 ? null : null}

              {group.fields
                .filter((f) => isFieldVisible(f, answers))
                .map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={answers[field.id] ?? null}
                    error={errors[field.id]}
                    disabled={submitted || closed}
                    formId={formId}
                    onChange={(v) => setAnswer(field.id, v)}
                  />
                ))}
            </Panel>
          ))}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              {!submitted && visibleAnswerable.length > 0 && (
                <span className="text-xs text-sbi-muted tabular-nums">
                  {answeredCount} of {visibleAnswerable.length} answered
                </span>
              )}
              <SaveIndicator state={saveState} submitted={submitted} />
            </div>
            {submitted ? (
              <button
                type="button"
                className={cn(btnGhost)}
                onClick={() => setSubmitted(false)}
              >
                Edit answers
              </button>
            ) : closed ? null : (
              <button
                type="button"
                className={cn(btnPrimary)}
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            )}
          </div>
        </motion.div>
      </main>

      <ConfirmDialog
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit your answers?"
        description="Once you submit, this form locks and you won't be able to edit your answers. Review them first if you're unsure."
        confirmLabel="Submit"
        cancelLabel="Keep editing"
        onConfirm={doSubmit}
      />
    </DashboardShell>
  );
}

function SaveIndicator({
  state,
  submitted,
}: {
  state: SaveState;
  submitted: boolean;
}) {
  if (submitted)
    return <span className="text-xs text-sbi-muted">Submitted</span>;
  if (state === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-sbi-muted">
        <Loader2 className="size-3 animate-spin" /> Saving draft…
      </span>
    );
  if (state === "saved")
    return <span className="text-xs text-sbi-green/80">Draft saved</span>;
  if (state === "error")
    return <span className="text-xs text-red-400">Couldn’t save draft</span>;
  return <span className="text-xs text-sbi-muted">Autosaves as you type</span>;
}

interface FieldGroup {
  key: string;
  section: FieldDef | null;
  fields: FieldDef[];
}

function groupBySection(fields: FieldDef[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  let current: FieldGroup = { key: "intro", section: null, fields: [] };
  for (const field of fields) {
    if (field.type === "section") {
      if (current.fields.length > 0 || current.section) groups.push(current);
      current = { key: field.id, section: field, fields: [] };
    } else {
      current.fields.push(field);
    }
  }
  if (current.fields.length > 0 || current.section) groups.push(current);
  return groups.length > 0
    ? groups
    : [{ key: "empty", section: null, fields: [] }];
}
