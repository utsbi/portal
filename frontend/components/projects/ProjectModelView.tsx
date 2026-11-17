"use client";

import { Box } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CameraConfig, CameraLimits, Project } from "@/lib/data/projects";
import {
  type DeviceTier,
  formatMegabytes,
  getDeviceTier,
  getNetworkInformation,
  getNetworkTier,
  getViewerQuality,
  type NetworkTier,
  REDUCED_DATA_QUERY,
  readDeviceSignals,
  readNetworkSignals,
} from "@/lib/viewer/tiers";
import {
  abortModelBytes,
  megabytesToBytes,
  startModelAssets,
  subscribeModelProgress,
} from "./modelAssets";
import type { Project3DViewerRef } from "./Project3DViewer";

const Project3DViewer = dynamic(
  () => import("./Project3DViewer").then((mod) => mod.Project3DViewer),
  { ssr: false },
);

interface ProjectModelViewProps {
  project: Project;
  viewerRef?: React.RefObject<Project3DViewerRef | null>;
  /** Called when the 3D viewer crashes (decode failure, offline, 404, lost GPU context). */
  onError?: () => void;
  /** The visitor asked for the model on a slow connection (the "Load 3D model" button). */
  onLoadRequested?: () => void;
}

// Start loading just before the stage scrolls into view. Kept small: on
// phones the stage starts ~250px below the fold, and visitors who never
// scroll that far should not pay for the model.
const NEAR_VIEWPORT_MARGIN = "100px 0px";
// A model ready this soon after it was requested came from cache: skip the
// reveal animation and fade the poster straight out.
const CACHED_READY_MS = 500;
const REVEAL_MS = 450;
// Bytes downloaded fill the bar to 90%; decoding and shader compilation
// hold it at 95% until the first frame is drawn.
const DOWNLOAD_SHARE = 90;
const DECODE_PROGRESS = 95;

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

interface ViewerTiers {
  network: NetworkTier;
  device: DeviceTier;
}

/** Unknown (null) until mounted, then follows connection changes. */
function useViewerTiers(): ViewerTiers | null {
  const [tiers, setTiers] = useState<ViewerTiers | null>(null);
  useEffect(() => {
    const device = getDeviceTier(readDeviceSignals());
    const update = () =>
      setTiers({ network: getNetworkTier(readNetworkSignals()), device });
    update();
    const connection = getNetworkInformation();
    const reducedData = window.matchMedia(REDUCED_DATA_QUERY);
    connection?.addEventListener?.("change", update);
    reducedData.addEventListener("change", update);
    return () => {
      connection?.removeEventListener?.("change", update);
      reducedData.removeEventListener("change", update);
    };
  }, []);
  return tiers;
}

/** Latches to true once the element comes within NEAR_VIEWPORT_MARGIN. */
function useNearViewport(ref: React.RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, near]);
  return near;
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
 * Interactive 3D model with its poster and loading overlay. Fills its
 * positioned parent.
 *
 * The project's cover image shows until the model is on screen. The viewer
 * chunk (three.js) and the model only load once the stage is near the
 * viewport, and on slow or data-saving connections only after the visitor
 * presses "Load 3D model".
 */
export function ProjectModelView({
  project,
  viewerRef,
  onError,
  onLoadRequested,
}: ProjectModelViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const modelUrl = project.modelUrl;
  const modelSizeBytes = megabytesToBytes(project.modelSizeMB);

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

  const tiers = useViewerTiers();
  const deviceTier = tiers?.device;
  const quality = useMemo(
    () => (deviceTier ? getViewerQuality(deviceTier) : null),
    [deviceTier],
  );
  const skyUrl = quality?.skyUrl;
  const nearViewport = useNearViewport(rootRef);
  // On slow connections the visitor opts in per project. A model that
  // already started loading counts as accepted, so a connection that turns
  // slow mid-download does not pull it away.
  const [consentedSlug, setConsentedSlug] = useState<string | null>(null);
  const awaitingConsent =
    tiers?.network === "constrained" && consentedSlug !== project.slug;
  const viewerRequested = Boolean(
    project.has3D &&
      modelUrl &&
      quality &&
      narrowStage !== null &&
      nearViewport &&
      !awaitingConsent,
  );

  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [goneUrl, setGoneUrl] = useState<string | null>(null);
  const [cachedReveal, setCachedReveal] = useState(false);
  const [progress, setProgress] = useState({ url: "", percent: 0 });
  const requestedAtRef = useRef(new Map<string, number>());
  const modelReady = Boolean(modelUrl) && readyUrl === modelUrl;
  const revealing = modelReady && revealedUrl !== modelUrl;

  // Start the model, decoder and sky downloads right away, in parallel with
  // the viewer chunk. If the visitor moves on before the model is ready, stop
  // its download so it does not compete with the next one.
  useEffect(() => {
    if (!viewerRequested || !modelUrl || !skyUrl) return;
    setConsentedSlug(project.slug);
    if (!requestedAtRef.current.has(modelUrl)) {
      requestedAtRef.current.set(modelUrl, performance.now());
    }
    startModelAssets(modelUrl, modelSizeBytes, skyUrl);
    const unsubscribe = subscribeModelProgress(modelUrl, (bytes) => {
      const percent = bytes.done
        ? DECODE_PROGRESS
        : bytes.total > 0
          ? Math.min(DOWNLOAD_SHARE, (bytes.loaded / bytes.total) * 100)
          : 0;
      setProgress({ url: modelUrl, percent });
    });
    return () => {
      unsubscribe();
      requestedAtRef.current.delete(modelUrl);
      abortModelBytes(modelUrl);
    };
  }, [viewerRequested, modelUrl, modelSizeBytes, skyUrl, project.slug]);

  // Decided here rather than in the reveal effect so the overlay already
  // carries the short exit transition when it starts leaving.
  const handleModelReady = useCallback((url: string) => {
    const requestedAt = requestedAtRef.current.get(url);
    setCachedReveal(
      requestedAt !== undefined &&
        performance.now() - requestedAt < CACHED_READY_MS,
    );
    setReadyUrl(url);
  }, []);

  // Fresh loads finish the bar and wipe; cached ones fade straight out.
  useEffect(() => {
    if (!revealing || !modelUrl) return;
    if (cachedReveal) {
      setRevealedUrl(modelUrl);
      return;
    }
    const timer = setTimeout(() => setRevealedUrl(modelUrl), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealing, modelUrl, cachedReveal]);

  // If the viewer crashes (decode failure, offline, 404, lost context),
  // dismiss the loading overlay and let the parent fall back to the image
  // gallery.
  const handleViewerError = useCallback(() => {
    if (modelUrl) setRevealedUrl(modelUrl);
    onError?.();
  }, [modelUrl, onError]);

  const handleLoadClick = () => {
    setConsentedSlug(project.slug);
    onLoadRequested?.();
  };

  const showOverlay = project.has3D && revealedUrl !== modelUrl;
  const displayProgress = modelReady
    ? 100
    : progress.url === modelUrl
      ? progress.percent
      : 0;
  const modelState = !viewerRequested
    ? "poster"
    : goneUrl === modelUrl && !showOverlay
      ? "ready"
      : "loading";

  return (
    <div
      ref={rootRef}
      data-model-state={modelState}
      className="absolute inset-0 overflow-hidden bg-sbi-dark"
    >
      {viewerRequested && modelUrl && quality && (
        <ViewerErrorBoundary
          resetKey={project.slug}
          onError={handleViewerError}
        >
          <Project3DViewer
            ref={viewerRef as React.RefObject<Project3DViewerRef>}
            modelUrl={modelUrl}
            modelSizeBytes={modelSizeBytes}
            quality={quality}
            cameraPresets={project.cameraPresets}
            defaultCamera={defaultCamera}
            cameraLimits={project.cameraLimits}
            modelScale={project.modelScale}
            lighting={project.lighting}
            autoRotate={false}
            onModelReady={handleModelReady}
            onContextLost={handleViewerError}
          />
        </ViewerErrorBoundary>
      )}

      {/* Poster and loading overlay */}
      <AnimatePresence
        mode="wait"
        onExitComplete={() => setGoneUrl(modelUrl ?? null)}
      >
        {showOverlay && (
          <motion.div
            key={project.slug}
            className="absolute inset-0 z-40 bg-sbi-dark flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: cachedReveal ? 0.25 : 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Image
              src={project.coverImage}
              alt=""
              fill
              preload
              sizes="(max-width: 1023px) 100vw, 900px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-sbi-dark/60" />

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
                {awaitingConsent ? "3D Model" : "Loading Model"}
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

              {awaitingConsent ? (
                <motion.button
                  type="button"
                  onClick={handleLoadClick}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="flex items-center gap-2 rounded-full border border-sbi-green/50 bg-sbi-dark/75 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur-md transition-colors hover:border-sbi-green hover:text-sbi-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green/70"
                >
                  <Box size={16} className="text-sbi-green" />
                  Load 3D model
                  {project.modelSizeMB
                    ? ` · ${formatMegabytes(project.modelSizeMB)}`
                    : ""}
                </motion.button>
              ) : (
                /* Progress bar */
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
              )}
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
              animate={{ scaleY: revealing && !cachedReveal ? 1 : 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
