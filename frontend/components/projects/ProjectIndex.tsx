import { Box, Images, Play } from "lucide-react";
import Image from "next/image";
import type { Project } from "@/lib/data/projects";
import { cn } from "@/lib/utils";

interface ProjectIndexProps {
  projects: Project[];
  activeSlug: string;
  onSelect: (project: Project) => void;
}

export function formatProjectNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

/**
 * Labeled index of every project. Renders as a 2-up card grid on phones,
 * a single row of cards on tablets, and a vertical list beside the media
 * stage on desktop — so the full set of projects is always visible.
 */
export function ProjectIndex({
  projects,
  activeSlug,
  onSelect,
}: ProjectIndexProps) {
  return (
    <nav aria-label="Projects">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-1">
        {projects.map((project, index) => {
          const isActive = project.slug === activeSlug;
          return (
            <li key={project.slug}>
              <button
                type="button"
                onClick={() => onSelect(project)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group relative flex h-full w-full flex-col overflow-hidden rounded-sm border text-left transition-colors duration-300 lg:flex-row lg:items-stretch",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green/70",
                  isActive
                    ? "border-sbi-green/60 bg-sbi-dark-card"
                    : "border-sbi-dark-border hover:border-sbi-green/30 hover:bg-sbi-dark-card/60",
                )}
              >
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-sbi-dark-card lg:aspect-auto lg:min-h-[5.25rem] lg:w-28">
                  <Image
                    src={project.coverImage}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 50vw, (max-width: 1023px) 25vw, 112px"
                    className={cn(
                      "object-cover transition duration-500 group-hover:scale-105",
                      isActive
                        ? "opacity-100"
                        : "opacity-60 group-hover:opacity-100",
                    )}
                  />
                  {isActive && (
                    <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-sm bg-sbi-dark/80 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-sbi-green backdrop-blur-sm lg:hidden">
                      <span className="h-1.5 w-1.5 rounded-full bg-sbi-green" />
                      Viewing
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 lg:justify-center lg:px-4">
                  <span
                    className={cn(
                      "font-mono text-[11px] tracking-widest transition-colors",
                      isActive ? "text-sbi-green" : "text-sbi-muted",
                    )}
                  >
                    {formatProjectNumber(index)}
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-sm leading-snug transition-colors",
                      isActive
                        ? "text-white"
                        : "text-white/75 group-hover:text-white",
                    )}
                  >
                    {project.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sbi-muted">
                    {project.has3D && (
                      <span className="flex items-center gap-1">
                        <Box size={12} aria-hidden="true" />
                        3D
                      </span>
                    )}
                    {project.videoUrl && (
                      <span className="flex items-center gap-1">
                        <Play size={12} aria-hidden="true" />
                        Video
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Images size={12} aria-hidden="true" />
                      {project.galleryImages.length}
                      <span className="sr-only">images</span>
                    </span>
                  </span>
                </div>

                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-0 left-0 h-0.5 w-full origin-left bg-sbi-green transition-transform duration-300 lg:h-full lg:w-0.5 lg:origin-top",
                    isActive ? "scale-100" : "scale-0",
                  )}
                />
              </button>
            </li>
          );
        })}
        <li className="col-span-2 md:col-span-4 lg:col-span-1">
          <div className="rounded-sm border border-dashed border-sbi-dark-border px-3 py-3 text-center text-xs italic text-sbi-muted">
            More projects coming soon
          </div>
        </li>
      </ul>
    </nav>
  );
}
