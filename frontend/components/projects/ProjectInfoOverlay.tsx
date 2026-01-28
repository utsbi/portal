"use client";

import { motion } from "motion/react";
import type { Project } from "@/lib/data/projects";

const statusLabels = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

const statusColors = {
  completed: "bg-sbi-green/20 text-sbi-green border-sbi-green/30",
  "in-progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  concept: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

interface ProjectInfoOverlayProps {
  project: Project;
}

export function ProjectInfoOverlay({ project }: ProjectInfoOverlayProps) {
  const handleScrollToDetails = () => {
    document
      .getElementById("project-details")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="absolute bottom-0 left-0 p-6 md:p-8 z-20">
      <motion.div
        key={project.slug}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="bg-sbi-dark/80 backdrop-blur-md px-5 py-4 rounded-lg border border-sbi-dark-border"
      >
        <h3 className="text-xl md:text-2xl font-light text-white tracking-tight mb-2">
          {project.title}
        </h3>

        <div className="flex items-center justify-between gap-4">
          <span
            className={`inline-block px-3 py-1 text-xs tracking-wider uppercase border ${statusColors[project.status]}`}
          >
            {statusLabels[project.status]}
          </span>

          <button
            type="button"
            onClick={handleScrollToDetails}
            className="flex items-center gap-2 text-white/50 hover:text-sbi-green transition-colors text-xs uppercase tracking-wider"
          >
            <span>Details</span>
            <motion.span
              animate={{ y: [0, 2, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              ↓
            </motion.span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
