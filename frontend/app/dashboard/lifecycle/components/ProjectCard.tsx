"use client";

import { ArrowRight, FolderKanban } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Project } from "../types";

type ProjectCardProps = {
  project: Project;
  index?: number;
};

const CIRCLE_RADIUS = 22;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export default function ProjectCard({ project, index = 0 }: ProjectCardProps) {
  const pct = Math.min(Math.max(project.progress_percent, 0), 100);
  const offset = CIRCLE_CIRCUMFERENCE - (pct / 100) * CIRCLE_CIRCUMFERENCE;
  const isComplete = project.completed || pct >= 100;
  const blocked = project.tasks.filter((t) => t.status === "blocked").length;
  const taskLabel = `${project.tasks.length} ${project.tasks.length === 1 ? "task" : "tasks"}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={`/dashboard/lifecycle/${project.id}`}
        className={cn(
          "group block bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded-xl overflow-hidden transition-colors hover:border-sbi-green/40 hover:bg-sbi-dark-card/60",
          isComplete && "opacity-65 hover:opacity-100",
        )}
      >
        <div className="relative h-40 overflow-hidden bg-sbi-dark-border/10">
          {project.image ? (
            <Image
              src={project.image}
              alt={project.title}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sbi-muted-dark/40">
              <FolderKanban className="h-12 w-12" strokeWidth={1.25} />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sbi-dark-card/95 to-transparent" />

          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-sbi-dark/70 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isComplete ? "bg-sbi-green" : "bg-amber-400"
              }`}
            />
            <span className={isComplete ? "text-sbi-green" : "text-amber-400"}>
              {isComplete ? "Complete" : "In Progress"}
            </span>
          </div>

          {blocked > 0 ? (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-sbi-dark/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-red-400 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {blocked} Blocked
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4 p-5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <svg
              className="h-14 w-14 -rotate-90"
              viewBox="0 0 56 56"
              role="img"
              aria-label={`${pct}% complete`}
            >
              <title>{`${pct}% complete`}</title>
              <circle
                cx="28"
                cy="28"
                r={CIRCLE_RADIUS}
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-sbi-dark-border/60"
              />
              <circle
                cx="28"
                cy="28"
                r={CIRCLE_RADIUS}
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={offset}
                className="text-sbi-green transition-[stroke-dashoffset] duration-700 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-xs font-medium tabular-nums text-white">
              {pct}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base text-white group-hover:text-sbi-green transition-colors">
              {project.title}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-sbi-muted-dark">
              {taskLabel}
            </p>
          </div>

          <ArrowRight className="h-4 w-4 shrink-0 text-sbi-muted-dark transition-all group-hover:text-sbi-green group-hover:translate-x-0.5" />
        </div>
      </Link>
    </motion.div>
  );
}
