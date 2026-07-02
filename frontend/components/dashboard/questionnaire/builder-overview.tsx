"use client";

import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileEdit,
  Loader2,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isActionError } from "@/app/dashboard/questionnaire/action-types";
import {
  deleteForm,
  duplicateForm,
} from "@/app/dashboard/questionnaire/actions";
import { StatSummary } from "@/components/dashboard/common/StatSummary";
import {
  btnGhost,
  btnPrimary,
  DashboardMain,
  DashboardShell,
  EmptyState,
  PageHeader,
  Panel,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import type { DirectorFormView } from "@/lib/data/questionnaire";
import { toastError, toastSuccess } from "@/lib/notifications";
import { FORM_TEMPLATES } from "@/lib/questionnaire/templates";
import { cn } from "@/lib/utils";

interface BuilderOverviewProps {
  forms: DirectorFormView[];
}

export function BuilderOverview({ forms }: BuilderOverviewProps) {
  const reduce = useReducedMotion() ?? false;
  const totalForms = forms.length;
  const published = forms.filter((f) => f.isActive).length;
  const totalSubmitted = forms.reduce((acc, f) => acc + f.submittedCount, 0);

  return (
    <DashboardShell>
      <PageHeader
        title="Form Builder"
        subtitle={
          totalForms === 0
            ? "Create customizable questionnaires for your clients"
            : `${totalForms} form${totalForms > 1 ? "s" : ""} · ${published} published`
        }
        action={
          <Link
            href="/dashboard/questionnaire/builder/new"
            className={btnPrimary}
          >
            <Plus className="size-4" /> New Form
          </Link>
        }
      />

      <DashboardMain>
        <div className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-1">
          <span className="mr-2 text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark">
            Start from a template:
          </span>
          {FORM_TEMPLATES.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/questionnaire/builder/new?template=${t.id}`}
              title={t.description}
              className="inline-flex h-8 items-center rounded-md px-2 text-xs text-sbi-muted transition-colors hover:bg-sbi-green/5 hover:text-sbi-green"
            >
              {t.name}
            </Link>
          ))}
          <span aria-hidden className="mx-1 h-3.5 w-px bg-sbi-dark-border/60" />
          <Link
            href="/dashboard/questionnaire/builder/templates"
            className="inline-flex h-8 items-center rounded-md px-2 text-xs text-sbi-green/80 transition-colors hover:text-sbi-green"
          >
            Manage templates →
          </Link>
        </div>

        {forms.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No forms yet"
            description="Build a questionnaire, assign it to a project, and clients can fill it out."
            action={
              <Link
                href="/dashboard/questionnaire/builder/new"
                className={cn(btnPrimary)}
              >
                <Plus className="size-4" /> Create your first form
              </Link>
            }
          />
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-8"
          >
            <StatSummary
              desktopGridClassName="sm:grid-cols-2 md:grid-cols-3"
              items={[
                {
                  label: "Total Forms",
                  value: totalForms,
                  sublabel: "Drafts and published",
                  icon: <ClipboardList className="h-4 w-4" />,
                },
                {
                  label: "Published",
                  value: published,
                  sublabel: "Visible to clients",
                  tone: "accent",
                  icon: <CheckCircle2 className="h-4 w-4" />,
                },
                {
                  label: "Submissions",
                  value: totalSubmitted,
                  sublabel: "Completed by clients",
                  icon: <Users className="h-4 w-4" />,
                },
              ]}
            />

            <div className="flex flex-col gap-3">
              <SectionLabel>Your Forms</SectionLabel>
              {forms.map((form, i) => (
                <FormCard key={form.id} form={form} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </DashboardMain>
    </DashboardShell>
  );
}

function FormCard({ form, index }: { form: DirectorFormView; index: number }) {
  const reduce = useReducedMotion() ?? false;
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
      <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/90 truncate">{form.title}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide",
                form.isActive
                  ? "bg-sbi-green/10 text-sbi-green"
                  : "bg-white/5 text-sbi-muted",
              )}
            >
              {form.isActive ? "Published" : "Draft"}
            </span>
            <span className="text-[10px] text-sbi-muted-dark">
              v{form.version}
            </span>
          </div>
          <p className="mt-1 text-xs text-sbi-muted">
            {form.questionCount} question{form.questionCount === 1 ? "" : "s"}
            {form.sectionCount > 0
              ? ` · ${form.sectionCount} section${form.sectionCount === 1 ? "" : "s"}`
              : ""}
            {` · ${form.assignedProjectIds.length} project${form.assignedProjectIds.length === 1 ? "" : "s"}`}
            {` · ${form.submittedCount} submitted`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link
            href={`/dashboard/questionnaire/builder/${form.id}/responses`}
            className={cn(btnGhost, "h-8 px-3 text-[11px]")}
          >
            <BarChart3 className="size-3.5" /> Responses
          </Link>
          <Link
            href={`/dashboard/questionnaire/builder/${form.id}`}
            className={cn(btnPrimary, "h-8 px-3 text-[11px]")}
          >
            <FileEdit className="size-3.5" /> Edit
          </Link>
          <DuplicateFormButton form={form} />
          <DeleteFormButton form={form} />
        </div>
      </Panel>
    </motion.div>
  );
}

function DuplicateFormButton({ form }: { form: DirectorFormView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDuplicate = async () => {
    setBusy(true);
    const res = await duplicateForm({ id: form.id });
    if (isActionError(res)) {
      toastError(res.error);
      setBusy(false);
      return;
    }
    toastSuccess("Form duplicated.");
    router.push(`/dashboard/questionnaire/builder/${res.id}`);
    router.refresh();
  };

  return (
    <button
      type="button"
      aria-label={`Duplicate ${form.title}`}
      title="Duplicate"
      disabled={busy}
      onClick={handleDuplicate}
      className="p-1.5 rounded-md text-sbi-muted hover:text-sbi-green hover:bg-sbi-green/10 transition-colors disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function DeleteFormButton({ form }: { form: DirectorFormView }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "deleting">("idle");

  const handleDelete = async () => {
    setState("deleting");
    const res = await deleteForm({ id: form.id });
    if (isActionError(res)) {
      toastError(res.error);
      setState("idle");
      return;
    }
    toastSuccess("Form deleted.");
    router.refresh();
  };

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDelete}
          className="h-8 px-2.5 rounded-md text-[11px] font-medium uppercase tracking-[0.04em] bg-red-500/10 text-red-300 border border-red-500/40 hover:bg-red-500/20 transition-colors"
        >
          Delete
        </button>
        <button
          type="button"
          aria-label="Cancel delete"
          onClick={() => setState("idle")}
          className="p-1.5 rounded-md text-sbi-muted hover:text-white transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Delete ${form.title}`}
      title="Delete form"
      disabled={state === "deleting"}
      onClick={() => setState("confirm")}
      className="p-1.5 rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
    >
      {state === "deleting" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </button>
  );
}
