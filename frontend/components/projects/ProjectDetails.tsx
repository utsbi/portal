"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import type { Project } from "@/lib/data/projects";
import { cn } from "@/lib/utils";

interface ProjectDetailsProps {
  project: Project;
  previous: Project;
  next: Project;
  onSelect: (project: Project) => void;
}

export function ProjectDetails({
  project,
  previous,
  next,
  onSelect,
}: ProjectDetailsProps) {
  return (
    <div className="mt-10 md:mt-14">
      <motion.div
        key={project.slug}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-8 md:grid-cols-3 md:gap-12"
      >
        <div className="md:col-span-2">
          <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-sbi-muted">
            About This Project
          </h3>
          <p className="text-base font-light leading-relaxed text-white/80 md:text-lg">
            {project.description}
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-sbi-muted">
            Categories
          </h3>
          <ul className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <li
                key={tag}
                className="border border-sbi-dark-border bg-sbi-dark-card px-3 py-1 text-sm text-white"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      <nav
        aria-label="Previous and next project"
        className="mt-10 grid grid-cols-2 gap-3 border-t border-sbi-dark-border pt-8 md:mt-14"
      >
        <AdjacentProjectCard
          project={previous}
          direction="previous"
          onSelect={onSelect}
        />
        <AdjacentProjectCard
          project={next}
          direction="next"
          onSelect={onSelect}
        />
      </nav>
    </div>
  );
}

interface AdjacentProjectCardProps {
  project: Project;
  direction: "previous" | "next";
  onSelect: (project: Project) => void;
}

function AdjacentProjectCard({
  project,
  direction,
  onSelect,
}: AdjacentProjectCardProps) {
  const isNext = direction === "next";
  return (
    <button
      type="button"
      onClick={() => onSelect(project)}
      className={cn(
        "group relative flex min-h-28 flex-col justify-between gap-4 overflow-hidden rounded-sm border border-sbi-dark-border p-4 transition-colors hover:border-sbi-green/50 md:min-h-36 md:p-6",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green/70",
        isNext ? "items-end text-right" : "items-start text-left",
      )}
    >
      <Image
        src={project.coverImage}
        alt=""
        fill
        sizes="(max-width: 1023px) 50vw, 420px"
        className="object-cover opacity-25 transition duration-500 group-hover:scale-105 group-hover:opacity-40"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-sbi-dark via-sbi-dark/70 to-sbi-dark/40" />
      <span className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sbi-muted transition-colors group-hover:text-sbi-green">
        {!isNext && <ArrowLeft size={14} />}
        {isNext ? "Next" : "Previous"}
        {isNext && <ArrowRight size={14} />}
      </span>
      <span className="relative line-clamp-2 text-sm font-light leading-snug text-white md:text-xl">
        {project.title}
      </span>
    </button>
  );
}
