"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type Project, TASK_STATUS_LABELS } from "../types";
import { StatusDonut } from "./StatusDonut";
import {
  countByStatus,
  STATUS_CHIP_STYLE,
  STATUS_DISPLAY_ORDER,
} from "./status-meta";

export function ProjectHeroCard({ project }: { project: Project }) {
  const counts = countByStatus(project.tasks);
  const blocked = counts.blocked;
  const dueLabel = project.tasks
    .filter((t) => t.status !== "completed")
    .map((t) => t.due_date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/dashboard/lifecycle/${project.id}`}
        className="group flex items-center gap-4 rounded-2xl border border-sbi-green/25 bg-gradient-to-br from-sbi-green/[0.07] to-white/[0.015] p-4 transition-colors hover:border-sbi-green/40 sm:gap-5 sm:p-6"
      >
        {/* Compact donut on phones, full size from sm up */}
        <div className="shrink-0 sm:hidden">
          <StatusDonut tasks={project.tasks} size={72} thickness={9} />
        </div>
        <div className="hidden shrink-0 sm:block">
          <StatusDonut tasks={project.tasks} size={108} thickness={12} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-light text-white group-hover:text-sbi-green transition-colors sm:text-lg">
            {project.title}
          </h2>
          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-sbi-muted-dark">
            {project.tasks.length}{" "}
            {project.tasks.length === 1 ? "task" : "tasks"}
            {dueLabel
              ? ` · next due ${dueLabel.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`
              : ""}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
            {STATUS_DISPLAY_ORDER.filter((s) => counts[s] > 0).map((status) => {
              const c = STATUS_CHIP_STYLE[status];
              return (
                <span
                  key={status}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-[11px]",
                    c.text,
                    c.border,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
                  {counts[status]} {TASK_STATUS_LABELS[status]}
                </span>
              );
            })}
          </div>

          {/* Compact open affordance inside the stack on phones */}
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-sbi-green/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sbi-green transition-colors group-hover:bg-sbi-green group-hover:text-sbi-dark sm:hidden">
            Open
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>

        <div className="hidden items-center gap-2 self-center sm:flex">
          {blocked > 0 ? (
            <span className="text-xs text-red-400">{blocked} blocked</span>
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-lg border border-sbi-green/40 px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-sbi-green transition-colors group-hover:bg-sbi-green group-hover:text-sbi-dark">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
