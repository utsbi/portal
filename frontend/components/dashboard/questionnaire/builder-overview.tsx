"use client";

import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  Plus,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  btnGhost,
  btnPrimary,
  DashboardShell,
  EmptyState,
  PageHeader,
  Panel,
  SectionLabel,
  StatTile,
} from "@/components/dashboard/common/ui";
import type { DirectorFormView } from "@/lib/data/questionnaire";
import { cn } from "@/lib/utils";

interface BuilderOverviewProps {
  forms: DirectorFormView[];
}

export function BuilderOverview({ forms }: BuilderOverviewProps) {
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
            className={cn(btnPrimary, "h-9")}
          >
            <Plus className="size-4" /> New Form
          </Link>
        }
      />

      <main className="flex-1 overflow-auto dashboard-scrollbar">
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatTile
                label="Total Forms"
                value={totalForms}
                icon={<ClipboardList className="h-4 w-4" />}
              />
              <StatTile
                label="Published"
                value={published}
                tone="accent"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <StatTile
                label="Submissions"
                value={totalSubmitted}
                sublabel="Completed by clients"
                icon={<Users className="h-4 w-4" />}
              />
            </div>

            <div className="flex flex-col gap-3">
              <SectionLabel>Your Forms</SectionLabel>
              {forms.map((form, i) => (
                <FormCard key={form.id} form={form} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </DashboardShell>
  );
}

function FormCard({ form, index }: { form: DirectorFormView; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Panel className="flex items-center gap-4">
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
        <div className="flex items-center gap-2 shrink-0">
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
        </div>
      </Panel>
    </motion.div>
  );
}
