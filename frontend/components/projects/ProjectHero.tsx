"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/data/projects";
import type { Project3DViewerRef } from "./Project3DViewer";
import { ProjectImageHero } from "./ProjectImageHero";

const Project3DViewer = dynamic(
  () => import("./Project3DViewer").then((mod) => mod.Project3DViewer),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-sbi-dark" />,
  },
);

interface ProjectHeroProps {
  project: Project;
  viewerRef?: React.RefObject<Project3DViewerRef | null>;
  children?: React.ReactNode;
}

const MIN_LOADING_MS = 1500;

class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function ProjectHero({
  project,
  viewerRef,
  children,
}: ProjectHeroProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "revealing" | "done">(
    "loading",
  );
  const hasCompletedRef = useRef(false);
  const modelLoadedRef = useRef(false);
  const loadingStartRef = useRef(Date.now());
  const sessionRef = useRef(0);
  const prevModelUrlRef = useRef(project.modelUrl);

  // Reset refs synchronously during render so they happen BEFORE
  // child effects (Model's onReady). useEffect runs bottom-up
  // (children first), so a useEffect reset would be too late for
  // cached models that signal ready immediately.
  if (project.has3D && project.modelUrl !== prevModelUrlRef.current) {
    prevModelUrlRef.current = project.modelUrl;
    sessionRef.current += 1;
    hasCompletedRef.current = false;
    modelLoadedRef.current = false;
    loadingStartRef.current = Date.now();
  }

  // State updates still need useEffect (can't call setState during render)
  useEffect(() => {
    if (project.has3D) {
      setPhase("loading");
      setDisplayProgress(0);
    }
  }, [project.modelUrl, project.has3D]);

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

  // Smooth animated progress bar with minimum display duration
  useEffect(() => {
    if (phase !== "loading") return;

    const startTime = loadingStartRef.current;
    let frameId: number;
    let lastUpdate = 0;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / MIN_LOADING_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

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
    <div className="relative w-full h-[calc(100dvh-80px)] mt-20 overflow-hidden bg-sbi-dark">
      {/* 3D Viewer or Parallax Image */}
      {project.has3D && project.modelUrl ? (
        <ViewerErrorBoundary
          fallback={
            project.galleryImages && project.galleryImages.length > 1 ? (
              <ProjectImageHero images={project.galleryImages} title={project.title} />
            ) : (
              <div className="absolute inset-0 bg-sbi-dark">
                <Image src={project.coverImage} alt={project.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-sbi-dark via-sbi-dark/50 to-transparent" />
              </div>
            )
          }
        >
          <Project3DViewer
            ref={viewerRef as React.RefObject<Project3DViewerRef>}
            modelUrl={project.modelUrl}
            cameraPresets={project.cameraPresets}
            defaultCamera={project.defaultCamera}
            cameraLimits={project.cameraLimits}
            modelScale={project.modelScale}
            autoRotate={true}
            onLoadProgress={handleLoadProgress}
            onModelReady={handleModelReady}
          />
        </ViewerErrorBoundary>
      ) : project.galleryImages && project.galleryImages.length > 1 ? (
        <ProjectImageHero
          images={project.galleryImages}
          title={project.title}
        />
      ) : (
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, ease: "linear" }}
        >
          <Image
            src={project.coverImage}
            alt={project.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sbi-dark via-sbi-dark/50 to-transparent" />
        </motion.div>
      )}

      {/* Full-screen loading overlay */}
      <AnimatePresence mode="wait">
        {phase !== "done" && project.has3D && (
          <motion.div
            key={project.modelUrl}
            className="absolute inset-0 z-40 bg-sbi-dark flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Subtle grid background */}
            <div className="absolute inset-0 overflow-hidden opacity-[0.02]">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <title>Loading grid</title>
                <defs>
                  <pattern id="project-loading-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#project-loading-grid)" />
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
                className="text-2xl md:text-3xl font-light tracking-tight text-white mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
            <div className="absolute top-8 left-8 w-12 h-12">
              <motion.div className="absolute top-0 left-0 w-full h-px bg-sbi-dark-border" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2, duration: 0.6 }} />
              <motion.div className="absolute top-0 left-0 h-full w-px bg-sbi-dark-border" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.2, duration: 0.6 }} />
            </div>
            <div className="absolute bottom-8 right-8 w-12 h-12">
              <motion.div className="absolute bottom-0 right-0 w-full h-px bg-sbi-dark-border" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6 }} />
              <motion.div className="absolute bottom-0 right-0 h-full w-px bg-sbi-dark-border" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.3, duration: 0.6 }} />
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

      {/* Bottom gradient hint — signals content below */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sbi-dark via-sbi-dark/30 to-transparent pointer-events-none z-10" />

      {/* Children (overlays) */}
      {children}
    </div>
  );
}
