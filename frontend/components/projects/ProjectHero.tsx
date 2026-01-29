"use client";

import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import type { Project } from "@/lib/data/projects";
import type { Project3DViewerRef } from "./Project3DViewer";
import { TransitionOverlay } from "./TransitionOverlay";

const Project3DViewer = dynamic(
  () => import("./Project3DViewer").then((mod) => mod.Project3DViewer),
  { ssr: false },
);

interface ProjectHeroProps {
  project: Project;
  viewerRef?: React.RefObject<Project3DViewerRef | null>;
  children?: React.ReactNode;
}

export function ProjectHero({
  project,
  viewerRef,
  children,
}: ProjectHeroProps) {
  const [isTransitioning, _setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  const handleLoadProgress = useCallback((percent: number) => {
    setLoadProgress(percent);
    if (percent >= 100) {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="relative w-full h-[calc(100dvh-80px)] mt-20 overflow-hidden bg-sbi-dark">
      {/* Loading progress bar */}
      {isLoading && project.has3D && (
        <div className="absolute top-0 left-0 right-0 z-30 h-1 bg-sbi-dark-border">
          <motion.div
            className="h-full bg-sbi-green"
            initial={{ width: 0 }}
            animate={{ width: `${loadProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* 3D Viewer or Parallax Image */}
      {project.has3D && project.modelUrl ? (
        <Project3DViewer
          ref={viewerRef as React.RefObject<Project3DViewerRef>}
          modelUrl={project.modelUrl}
          cameraPresets={project.cameraPresets}
          autoRotate={true}
          onLoadProgress={handleLoadProgress}
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

      {/* Transition Overlay */}
      <TransitionOverlay isVisible={isTransitioning} />

      {/* Bottom gradient hint — signals content below */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sbi-dark via-sbi-dark/30 to-transparent pointer-events-none z-10" />

      {/* Children (overlays) */}
      {children}
    </div>
  );
}
