"use client";

import { FilePlus2, Loader2, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isActionError } from "@/app/dashboard/questionnaire/action-types";
import { deleteTemplate } from "@/app/dashboard/questionnaire/actions";
import {
  btnGhost,
  btnPrimary,
  DashboardMain,
  DashboardShell,
  PageHeader,
  Panel,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import type { CustomTemplateView } from "@/lib/data/questionnaire";
import { toastError, toastSuccess } from "@/lib/notifications";
import { isAnswerableType } from "@/lib/questionnaire/schema";
import { FORM_TEMPLATES } from "@/lib/questionnaire/templates";
import { cn } from "@/lib/utils";

interface TemplatesViewProps {
  templates: CustomTemplateView[];
}

export function TemplatesView({ templates }: TemplatesViewProps) {
  const reduce = useReducedMotion() ?? false;

  return (
    <DashboardShell>
      <PageHeader
        title="Templates"
        subtitle="Reusable question sets to start new forms from"
        action={
          <Link
            href="/dashboard/questionnaire/builder"
            className={cn(btnGhost, "h-9")}
          >
            Back
          </Link>
        }
      />

      <DashboardMain>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-8 max-w-3xl"
        >
          <div className="flex flex-col gap-3">
            <SectionLabel>Built-in</SectionLabel>
            {FORM_TEMPLATES.map((t) => (
              <TemplateRow
                key={t.id}
                name={t.name}
                description={t.description}
                count={t.fields.filter((f) => isAnswerableType(f.type)).length}
                href={`/dashboard/questionnaire/builder/new?template=${t.id}`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <SectionLabel>Your templates</SectionLabel>
            {templates.length === 0 ? (
              <p className="px-1 text-xs text-sbi-muted">
                Save a form as a template from the builder, and it shows up here
                to reuse.
              </p>
            ) : (
              templates.map((t) => (
                <CustomTemplateRow key={t.id} template={t} />
              ))
            )}
          </div>
        </motion.div>
      </DashboardMain>
    </DashboardShell>
  );
}

function TemplateRow({
  name,
  description,
  count,
  href,
  children,
}: {
  name: string;
  description: string | null;
  count: number;
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Panel className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white/90">{name || "Untitled"}</span>
        <p className="mt-1 text-xs text-sbi-muted">
          {count} question{count === 1 ? "" : "s"}
          {description ? ` · ${description}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={href} className={cn(btnPrimary, "h-8 px-3 text-[11px]")}>
          <FilePlus2 className="size-3.5" /> Use
        </Link>
        {children}
      </div>
    </Panel>
  );
}

function CustomTemplateRow({ template }: { template: CustomTemplateView }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "deleting">("idle");

  const handleDelete = async () => {
    setState("deleting");
    const res = await deleteTemplate({ id: template.id });
    if (isActionError(res)) {
      toastError(res.error);
      setState("idle");
      return;
    }
    toastSuccess("Template deleted.");
    router.refresh();
  };

  return (
    <TemplateRow
      name={template.name}
      description={template.description}
      count={template.questionCount}
      href={`/dashboard/questionnaire/builder/new?customTemplate=${template.id}`}
    >
      {state === "confirm" ? (
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
            aria-label="Cancel"
            onClick={() => setState("idle")}
            className="p-1.5 rounded-md text-sbi-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${template.name}`}
          title="Delete template"
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
      )}
    </TemplateRow>
  );
}
