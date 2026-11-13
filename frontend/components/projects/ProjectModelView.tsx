"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CameraConfig, CameraLimits, Project } from "@/lib/data/projects";
import type { Project3DViewerRef } from "./Project3DViewer";

const Project3DViewer = dynamic(
  () => import("./Project3DViewer").then((mod) => mod.Project3DViewer),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-sbi-dark" />,
  },
);

interface ProjectModelViewProps {
  project: Project;
  viewerRef?: React.RefObject<Project3DViewerRef | null>;
  /** Called when the 3D viewer crashes (decode failure, offline, 404). */
  onError?: () => void;
}

const MIN_LOADING_MS = 1500;

// Default cameras are framed for a wide (16:10) stage. On phones the stage is
// square, so the camera backs away by the ratio between the two to keep the
// whole model in frame, without leaving the project's zoom limits.
const NARROW_STAGE_QUERY = "(max-width: 639px)";
const NARROW_STAGE_PULLBACK = 1.6;

function fitCameraToStage(
  camera: CameraConfig | undefined,
  limits: CameraLimits | undefined,
  narrow: boolean,
): CameraConfig | undefined {
  if (!camera || !narrow) return camera;
  const [px, py, pz] = camera.position;
  const [tx, ty, tz] = camera.target;
  const distance = Math.hypot(px - tx, py - ty, pz - tz);
  if (distance === 0) return camera;
  const scale = Math.min(
    NARROW_STAGE_PULLBACK,
    (limits?.maxDistance ?? distance * NARROW_STAGE_PULLBACK) / distance,
  );
  if (scale <= 1) return camera;
  return {
    target: camera.target,
    position: [
      tx + (px - tx) * scale,
      ty + (py - ty) * scale,
      tz + (pz - tz) * scale,
    ],
  };
}

interface ViewerErrorBoundaryProps {
  children: React.ReactNode;
  /** Changing this clears a previous crash so the next project can load. */
  resetKey: string;
  onError?: () => void;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
  resetKey: string;
}

class ViewerErrorBoundary extends React.Component<
  ViewerErrorBoundaryProps,
  ViewerErrorBoundaryState
> {
  constructor(props: ViewerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: ViewerErrorBoundaryProps,
    state: ViewerErrorBoundaryState,
  ) {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("3D Viewer crashed:", error, info.componentStack);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Interactive 3D model with its loading overlay. Fills its positioned parent.
 */
export function ProjectModelView({
  project,
  viewerRef,
  onError,
}: ProjectModelViewProps) {
  // Unknown until mounted; the viewer waits for it so the camera is created
  // at its final position instead of jumping after the first paint.
  const [narrowStage, setNarrowStage] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(NARROW_STAGE_QUERY);
    const update = () => setNarrowStage(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const defaultCamera = useMemo(
    () =>
      fitCameraToStage(
        project.defaultCamera,
        project.cameraLimits,
        narrowStage === true,
      ),
    [project.defaultCamera, project.cameraLimits, narrowStage],
  );

  const [displayProgress, setDisplayProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "revealing" | "done">(
    "loading",
  );
  const hasCompletedRef = useRef(false);
  const modelLoadedRef = useRef(false);
  const loadingStartRef = useRef(Date.now());
  const sessionRef = useRef(0);
  const prevSlugRef = useRef(project.slug);

  // Reset refs synchronously during render so they happen BEFORE
  // child effects (Model's onReady). useEffect runs bottom-up
  // (children first), so a useEffect reset would be too late for
  // cached models that signal ready immediately.
  // Track slug (not modelUrl) so navigating 3D → non-3D → same 3D
  // still resets stale refs like hasCompletedRef.
  if (project.has3D && project.slug !== prevSlugRef.current) {
    prevSlugRef.current = project.slug;
    sessionRef.current += 1;
    hasCompletedRef.current = false;
    modelLoadedRef.current = false;
    loadingStartRef.current = Date.now();
  }
  // Keep prevSlugRef in sync even for non-3D projects
  if (!project.has3D) {
    prevSlugRef.current = project.slug;
  }

  // State updates still need useEffect (can't call setState during render)
  // biome-ignore lint/correctness/useExhaustiveDependencies: project.slug intentionally re-runs this effect on project change to reset loading phase; setState setters are stable
  useEffect(() => {
    if (project.has3D) {
      setPhase("loading");
      setDisplayProgress(0);
    }
  }, [project.slug, project.has3D]);

  const triggerCompletion = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    const session = sessionRef.current;
    setDisplayProgress(100);
    setTimeout(() => {
      if (sessionRef.current !== session) return;
      setPhase("revealing");
    }, 300);
    setTimeout(() => {
      if (sessionRef.current !== session) return;
      setPhase("done");
    }, 1000);
  }, []);

  // drei reports real load progress — backup signal for fresh (non-cached) loads
  const handleLoadProgress = useCallback((percent: number) => {
    if (percent >= 100) {
      modelLoadedRef.current = true;
    }
  }, []);

  // Direct signal from Model component — works for both cached and fresh loads
  const handleModelReady = useCallback(() => {
    modelLoadedRef.current = true;
  }, []);

  // If the viewer crashes (decode failure, offline, 404), dismiss the loading
  // overlay — otherwise it would sit at 85% forever — and let the parent fall
  // back to the image gallery.
  const handleViewerError = useCallback(() => {
    hasCompletedRef.current = true;
    setPhase("done");
    onError?.();
  }, [onError]);

  // Smooth animated progress bar with minimum display duration
  useEffect(() => {
    if (phase !== "loading") return;

    const startTime = loadingStartRef.current;
    let frameId: number;
    let lastUpdate = 0;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / MIN_LOADING_MS, 1);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic

      if (modelLoadedRef.current && elapsed >= MIN_LOADING_MS) {
        triggerCompletion();
        return;
      }

      // Cap at 85% while model loads, 95% while waiting for min time
      const cap = modelLoadedRef.current ? 95 : 85;
      const now = Date.now();
      if (now - lastUpdate > 100) {
        setDisplayProgress(Math.min(eased * cap, cap));
        lastUpdate = now;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [phase, triggerCompletion]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-sbi-dark">
      {project.has3D && project.modelUrl && narrowStage !== null && (
        <ViewerErrorBoundary
          resetKey={project.slug}
          onError={handleViewerError}
        >
          <Project3DViewer
            ref={viewerRef as React.RefObject<Project3DViewerRef>}
            modelUrl={project.modelUrl}
            cameraPresets={project.cameraPresets}
            defaultCamera={defaultCamera}
            cameraLimits={project.cameraLimits}
            modelScale={project.modelScale}
            autoRotate={false}
            onLoadProgress={handleLoadProgress}
            onModelReady={handleModelReady}
          />
        </ViewerErrorBoundary>
      )}

      {/* Loading overlay */}
      <AnimatePresence mode="wait">
        {phase !== "done" && project.has3D && (
          <motion.div
            key={project.slug}
            className="absolute inset-0 z-40 bg-sbi-dark flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Subtle grid background */}
            <div className="absolute inset-0 overflow-hidden opacity-[0.02]">
              <svg
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Loading grid</title>
                <defs>
                  <pattern
                    id="project-loading-grid"
                    width="60"
                    height="60"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 60 0 L 0 0 0 60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="url(#project-loading-grid)"
                />
              </svg>
            </div>

            <div className="relative flex flex-col items-center">
              {/* Project title */}
              <motion.span
                className="text-xs tracking-[0.3em] uppercase text-sbi-green mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                Loading Model
              </motion.span>

              <motion.h2
                className="px-6 text-center text-xl md:text-3xl font-light tracking-tight text-white mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {project.title}
              </motion.h2>

              {/* Progress bar */}
              <div className="relative w-48 md:w-64">
                <div className="h-px bg-sbi-dark-border w-full" />
                <motion.div
                  className="absolute top-0 left-0 h-px bg-sbi-green origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: displayProgress / 100 }}
                  transition={{ duration: 0.3, ease: "linear" }}
                />
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-sbi-green rounded-full"
                  initial={{ left: 0 }}
                  animate={{ left: `${Math.min(displayProgress, 100)}%` }}
                  transition={{ duration: 0.3, ease: "linear" }}
                >
                  <motion.div
                    className="absolute inset-0 bg-sbi-green rounded-full"
                    animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </motion.div>
                <motion.div
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs tracking-[0.3em] text-sbi-muted tabular-nums"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {Math.floor(displayProgress)}%
                </motion.div>
              </div>
            </div>

            {/* Corner accents (top-left and bottom-right only, simpler than home) */}
            <div className="absolute top-4 left-4 w-8 h-8 md:top-8 md:left-8 md:w-12 md:h-12">
              <motion.div
                className="absolute top-0 left-0 w-full h-px bg-sbi-dark-border"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />
              <motion.div
                className="absolute top-0 left-0 h-full w-px bg-sbi-dark-border"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />
            </div>
            <div className="absolute bottom-4 right-4 w-8 h-8 md:bottom-8 md:right-8 md:w-12 md:h-12">
              <motion.div
                className="absolute bottom-0 right-0 w-full h-px bg-sbi-dark-border"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-full w-px bg-sbi-dark-border"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              />
            </div>

            {/* Reveal wipe overlay */}
            <motion.div
              className="absolute inset-0 bg-sbi-dark origin-top"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: phase === "revealing" ? 1 : 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
