"use client";

import { motion } from "motion/react";
import type { Project } from "@/lib/data/projects";

const statusLabels = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

const statusColors = {
  completed: "bg-sbi-green/20 text-sbi-green",
  "in-progress": "bg-amber-500/20 text-amber-400",
  concept: "bg-blue-500/20 text-blue-400",
};

interface ProjectInfoOverlayProps {
  project: Project;
}

export function ProjectInfoOverlay({ project }: ProjectInfoOverlayProps) {
  return (
    <div className="absolute bottom-0 left-0 p-6 md:p-8 z-20 max-w-md md:max-w-lg">
      <motion.div
        key={project.slug}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="bg-sbi-dark/80 backdrop-blur-md p-6 rounded-lg border border-sbi-dark-border"
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`px-3 py-1 text-xs tracking-wider uppercase ${statusColors[project.status]}`}
          >
            {statusLabels[project.status]}
          </span>
        </div>

        <h3 className="text-xl md:text-2xl lg:text-3xl font-light text-white mb-3 tracking-tight">
          {project.title}
        </h3>

        <p className="text-sbi-muted leading-relaxed mb-4 line-clamp-2 md:line-clamp-3 text-sm md:text-base">
          {project.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {project.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs text-sbi-muted-dark border border-sbi-dark-border"
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
