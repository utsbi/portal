"use client";

import { ChevronDown, History, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isActionError } from "@/app/dashboard/questionnaire/action-types";
import { restoreFormVersion } from "@/app/dashboard/questionnaire/actions";
import {
  btnGhost,
  DashboardMain,
  DashboardShell,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FormVersionView } from "@/lib/data/questionnaire";
import { toastError, toastSuccess } from "@/lib/notifications";
import { FIELD_TYPE_LABELS } from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";

interface FormHistoryProps {
  formId: number;
  title: string;
  versions: FormVersionView[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function FormHistory({ formId, title, versions }: FormHistoryProps) {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pendingRestore, setPendingRestore] = useState<number | null>(null);

  const doRestore = async () => {
    if (pendingRestore === null) return;
    const version = pendingRestore;
    const res = await restoreFormVersion({ formId, version });
    setPendingRestore(null);
    if (isActionError(res)) {
      toastError(res.error);
      return;
    }
    toastSuccess(`Restored version ${version} as v${res.version}.`);
    router.push(`/dashboard/questionnaire/builder/${formId}`);
    router.refresh();
  };

  return (
    <DashboardShell>
      <PageHeader
        title={title}
        subtitle="Version history"
        action={
          <Link
            href={`/dashboard/questionnaire/builder/${formId}`}
            className={cn(btnGhost, "h-9")}
          >
            Back to editor
          </Link>
        }
      />

      <DashboardMain>
        {versions.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No version history"
            description="Edits to this form will be snapshotted here as new versions."
          />
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2 max-w-3xl"
          >
            {versions.map((v) => {
              const open = expanded === v.version;
              return (
                <Panel
                  key={v.version}
                  padded={false}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm text-white/90 tabular-nums shrink-0">
                      v{v.version}
                    </span>
                    {v.isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide bg-sbi-green/10 text-sbi-green shrink-0">
                        Current
                      </span>
                    )}
                    <span className="flex-1 min-w-0 text-xs text-sbi-muted truncate">
                      {formatDate(v.createdAt)} · {v.questionCount} question
                      {v.questionCount === 1 ? "" : "s"}
                      {v.sectionCount > 0
                        ? ` · ${v.sectionCount} section${v.sectionCount === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((cur) =>
                          cur === v.version ? null : v.version,
                        )
                      }
                      className="p-1.5 rounded-md text-sbi-muted hover:text-white hover:bg-white/5 transition-colors shrink-0"
                      aria-label={open ? "Hide questions" : "Show questions"}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {!v.isCurrent && (
                      <button
                        type="button"
                        onClick={() => setPendingRestore(v.version)}
                        className={cn(
                          btnGhost,
                          "h-8 px-3 text-[11px] shrink-0",
                        )}
                      >
                        <RotateCcw className="size-3.5" /> Restore
                      </button>
                    )}
                  </div>

                  {open && (
                    <div className="border-t border-sbi-dark-border/40 px-4 py-3 flex flex-col gap-1.5">
                      {v.schema.fields.length === 0 ? (
                        <p className="text-xs text-sbi-muted-dark">
                          No questions in this version.
                        </p>
                      ) : (
                        v.schema.fields.map((f, i) => (
                          <div
                            key={f.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="text-sbi-muted-dark tabular-nums w-5 shrink-0">
                              {f.type === "section" ? "§" : i + 1}
                            </span>
                            <span className="text-white/80 truncate">
                              {f.label}
                            </span>
                            <span className="ml-auto text-[10px] uppercase tracking-[0.1em] text-sbi-muted-dark shrink-0">
                              {FIELD_TYPE_LABELS[f.type]}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </Panel>
              );
            })}
          </motion.div>
        )}
      </DashboardMain>

      <ConfirmDialog
        opened={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title={`Restore version ${pendingRestore ?? ""}?`}
        description="This re-applies that version's questions as a new version. Nothing is lost: your current version stays in the history and you can switch back."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={doRestore}
      />
    </DashboardShell>
  );
}
