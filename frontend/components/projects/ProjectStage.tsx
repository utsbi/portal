"use client";

import {
  Box,
  ChevronLeft,
  ChevronRight,
  Hand,
  Lock,
  Maximize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/data/projects";
import { cn } from "@/lib/utils";
import { CameraControlsUI } from "./CameraControlsUI";
import type { Project3DViewerRef } from "./Project3DViewer";
import { formatProjectNumber } from "./ProjectIndex";
import { ProjectLightbox } from "./ProjectLightbox";
import { ProjectModelView } from "./ProjectModelView";

type MediaSelection =
  | { type: "model" }
  | { type: "video" }
  | { type: "image"; index: number };

interface ProjectStageProps {
  project: Project;
  index: number;
  total: number;
}

const SWIPE_THRESHOLD_PX = 40;

const statusLabels: Record<Project["status"], string> = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

const statusColors: Record<Project["status"], string> = {
  completed: "bg-sbi-green/10 text-sbi-green border-sbi-green/30",
  "in-progress": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  concept: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

function hasModel(project: Project) {
  return project.has3D && Boolean(project.modelUrl);
}

function getDefaultMedia(project: Project): MediaSelection {
  return hasModel(project) ? { type: "model" } : { type: "image", index: 0 };
}

function getYouTubeId(url?: string) {
  return url?.match(/(?:v=|\/)([\w-]{11})/)?.[1];
}

/** True on touch-first devices, where a drag should scroll the page. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return coarse;
}

/**
 * One stage for all of a project's media — the interactive 3D model, the
 * video, and every gallery image — with a tile for each item underneath.
 */
export function ProjectStage({ project, index, total }: ProjectStageProps) {
  const viewerRef = useRef<Project3DViewerRef>(null);
  const touchStartX = useRef<number | null>(null);
  const isCoarsePointer = useCoarsePointer();

  const [media, setMedia] = useState<MediaSelection>(() =>
    getDefaultMedia(project),
  );
  const [cameraIndex, setCameraIndex] = useState(-1);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [touchUnlocked, setTouchUnlocked] = useState(false);
  const [failedModelSlug, setFailedModelSlug] = useState<string | null>(null);

  // Reset per-project view state during render (not in an effect) so the new
  // project never paints with the previous project's selection.
  const [renderedSlug, setRenderedSlug] = useState(project.slug);
  if (renderedSlug !== project.slug) {
    setRenderedSlug(project.slug);
    setMedia(getDefaultMedia(project));
    setCameraIndex(-1);
    setLightboxIndex(null);
    setTouchUnlocked(false);
  }

  const images = project.galleryImages;
  const videoId = getYouTubeId(project.videoUrl);
  const modelAvailable = hasModel(project) && failedModelSlug !== project.slug;
  const activeMedia: MediaSelection =
    media.type === "model" && !modelAvailable
      ? { type: "image", index: 0 }
      : media;
  const activeImageIndex =
    activeMedia.type === "image" ? activeMedia.index : -1;

  const handleModelError = useCallback(() => {
    setFailedModelSlug(project.slug);
  }, [project.slug]);

  const handleCameraSelect = useCallback((presetIndex: number) => {
    setCameraIndex(presetIndex);
    viewerRef.current?.setCamera(presetIndex);
  }, []);

  const handleCameraReset = useCallback(() => {
    setCameraIndex(-1);
    viewerRef.current?.resetCamera();
  }, []);

  const stepImage = useCallback(
    (delta: number) => {
      setMedia((current) => {
        const from = current.type === "image" ? current.index : 0;
        return {
          type: "image",
          index: (from + delta + images.length) % images.length,
        };
      });
    },
    [images.length],
  );

  const mediaSummary = [
    modelAvailable ? "3D model" : null,
    videoId ? "Video" : null,
    `${images.length} ${images.length === 1 ? "image" : "images"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <motion.div
        key={project.slug}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 md:mb-5"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs tracking-widest text-sbi-green">
            {formatProjectNumber(index)} / {formatProjectNumber(total - 1)}
          </span>
          <span
            className={cn(
              "whitespace-nowrap border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]",
              statusColors[project.status],
            )}
          >
            {statusLabels[project.status]}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-light tracking-tight text-white sm:text-3xl lg:text-4xl">
          {project.title}
        </h2>
      </motion.div>

      {/* Stage */}
      <div
        className={cn(
          "relative isolate w-full overflow-hidden rounded-sm border border-sbi-dark-border bg-sbi-dark-card",
          activeMedia.type === "model" && "aspect-square sm:aspect-[16/10]",
          activeMedia.type === "image" && "aspect-[4/3] sm:aspect-[16/10]",
          activeMedia.type === "video" && "aspect-video",
        )}
      >
        {/* 3D model — stays mounted while other media is shown so switching
            back is instant and the WebGL context is not rebuilt. */}
        {modelAvailable && (
          <div
            className={cn(
              "absolute inset-0",
              activeMedia.type !== "model" && "pointer-events-none invisible",
            )}
          >
            <ProjectModelView
              project={project}
              viewerRef={viewerRef}
              onError={handleModelError}
            />

            {/* On touch devices a drag scrolls the page until the visitor
                opts in, so the model never traps scrolling. */}
            {isCoarsePointer && !touchUnlocked && (
              <button
                type="button"
                onClick={() => setTouchUnlocked(true)}
                className="absolute inset-0 z-10 flex items-center justify-center"
              >
                <span className="flex items-center gap-2 rounded-full border border-white/15 bg-sbi-dark/75 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur-md">
                  <Hand size={16} className="text-sbi-green" />
                  Tap to explore in 3D
                </span>
              </button>
            )}

            <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 md:left-4 md:top-4">
              <span className="flex items-center gap-1.5 rounded-sm border border-sbi-dark-border bg-sbi-dark/70 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
                <Box size={12} className="text-sbi-green" />
                3D Model
              </span>
              {isCoarsePointer && touchUnlocked && (
                <button
                  type="button"
                  onClick={() => setTouchUnlocked(false)}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-sm border border-sbi-green/40 bg-sbi-dark/70 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-sbi-green backdrop-blur-md"
                >
                  <Lock size={12} />
                  Done
                </button>
              )}
              {!isCoarsePointer && (
                <span className="hidden text-xs text-white/50 md:inline">
                  Drag to rotate · Scroll to zoom
                </span>
              )}
            </div>

            <CameraControlsUI
              presets={project.cameraPresets}
              activeIndex={cameraIndex}
              onPresetSelect={handleCameraSelect}
              onReset={handleCameraReset}
            />

            <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 rounded-lg border border-sbi-dark-border bg-sbi-dark/60 p-1 backdrop-blur-md md:bottom-4 md:right-4">
              <button
                type="button"
                onClick={() => viewerRef.current?.zoomIn()}
                className="rounded p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Zoom in"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => viewerRef.current?.zoomOut()}
                className="rounded p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Zoom out"
              >
                <Minus size={16} />
              </button>
              {!project.cameraPresets?.length && (
                <button
                  type="button"
                  onClick={handleCameraReset}
                  className="rounded p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Reset view"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image */}
        {activeMedia.type === "image" && images.length > 0 && (
          <div className="absolute inset-0">
            <button
              type="button"
              onClick={() => setLightboxIndex(activeMedia.index)}
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0].clientX;
              }}
              onTouchEnd={(event) => {
                if (touchStartX.current === null) return;
                const delta =
                  event.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
                event.preventDefault();
                stepImage(delta < 0 ? 1 : -1);
              }}
              aria-label="View image fullscreen"
              className="absolute inset-0 cursor-zoom-in"
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={images[activeMedia.index].src}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={images[activeMedia.index]}
                    alt={`${project.title} — image ${activeMedia.index + 1} of ${images.length}`}
                    fill
                    sizes="(max-width: 1023px) 100vw, 900px"
                    className="object-cover"
                    priority={activeMedia.index === 0}
                  />
                </motion.span>
              </AnimatePresence>
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-sbi-dark/80 to-transparent p-3 pt-10 md:p-4 md:pt-12">
              <span className="font-mono text-xs tracking-widest text-white/80">
                {String(activeMedia.index + 1).padStart(2, "0")} /{" "}
                {String(images.length).padStart(2, "0")}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-white/70">
                <Maximize2 size={12} />
                Expand
              </span>
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => stepImage(-1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-sbi-dark/60 text-white backdrop-blur-md transition-colors hover:border-sbi-green/50 hover:text-sbi-green md:left-4"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => stepImage(1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-sbi-dark/60 text-white backdrop-blur-md transition-colors hover:border-sbi-green/50 hover:text-sbi-green md:right-4"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Video */}
        {activeMedia.type === "video" && videoId && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={`${project.title} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full bg-black"
          />
        )}
      </div>

      {/* Media tiles */}
      <div className="mt-4">
        <div className="mb-2.5 flex items-baseline justify-between gap-4">
          <h3 className="text-xs uppercase tracking-[0.3em] text-sbi-muted">
            Media
          </h3>
          <span className="text-xs text-sbi-muted">{mediaSummary}</span>
        </div>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-8">
          {modelAvailable && (
            <li>
              <MediaTile
                label="View 3D model"
                active={activeMedia.type === "model"}
                onClick={() => setMedia({ type: "model" })}
              >
                <Image
                  src={project.coverImage}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover opacity-40"
                />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white">
                  <Box size={18} className="text-sbi-green" />
                  <span className="text-[10px] uppercase tracking-[0.2em]">
                    3D
                  </span>
                </span>
              </MediaTile>
            </li>
          )}
          {videoId && (
            <li>
              <MediaTile
                label="Play video"
                active={activeMedia.type === "video"}
                onClick={() => setMedia({ type: "video" })}
              >
                {/* biome-ignore lint/performance/noImgElement: external YouTube thumbnail served from img.youtube.com; using next/image would require remote-domain config and change loading behavior */}
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white">
                  <Play size={18} className="fill-sbi-green text-sbi-green" />
                  <span className="text-[10px] uppercase tracking-[0.2em]">
                    Video
                  </span>
                </span>
              </MediaTile>
            </li>
          )}
          {images.map((image, imageIndex) => (
            <li key={image.src}>
              <MediaTile
                label={`Show image ${imageIndex + 1} of ${images.length}`}
                active={activeImageIndex === imageIndex}
                onClick={() => setMedia({ type: "image", index: imageIndex })}
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </MediaTile>
            </li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && images.length > 0 && (
          <ProjectLightbox
            images={images}
            index={lightboxIndex}
            title={project.title}
            onIndexChange={(next) => {
              setLightboxIndex(next);
              setMedia({ type: "image", index: next });
            }}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface MediaTileProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function MediaTile({ label, active, onClick, children }: MediaTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative block aspect-[4/3] w-full overflow-hidden rounded-sm border bg-sbi-dark-card transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green/70",
        active
          ? "border-sbi-green opacity-100"
          : "border-sbi-dark-border opacity-60 hover:border-sbi-green/40 hover:opacity-100",
      )}
    >
      {children}
    </button>
  );
}
