"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "revealing" | "done">(
    "loading",
  );
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const triggerCompletion = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    setProgress(100);
    setTimeout(() => setPhase("revealing"), 300);
    setTimeout(() => {
      setPhase("done");
      onCompleteRef.current();
    }, 1200);
  }, []);

  useEffect(() => {
    const duration = 1200;
    const interval = 16;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const baseProgress = (currentStep / steps) * 100;
      const jitter = Math.random() * 3;
      const newProgress = Math.min(baseProgress + jitter, 99);

      if (currentStep >= steps) {
        clearInterval(timer);
        triggerCompletion();
        return;
      }

      setProgress(newProgress);
    }, interval);

    const safetyTimeout = setTimeout(() => {
      clearInterval(timer);
      triggerCompletion();
    }, duration + 500);

    return () => {
      clearInterval(timer);
      clearTimeout(safetyTimeout);
    };
  }, [triggerCompletion]);

  return (
    <motion.div
      className="fixed inset-0 z-100 bg-sbi-dark flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{
        opacity: phase === "done" ? 0 : 1,
        pointerEvents: phase === "done" ? "none" : "auto",
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 overflow-hidden opacity-[0.02]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <title>Loading grid</title>
          <defs>
            <pattern
              id="loading-grid"
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
          <rect width="100%" height="100%" fill="url(#loading-grid)" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center">
        <div className="flex items-center gap-1 mb-12">
          {["S", "B", "I"].map((letter, index) => (
            <motion.div
              key={letter}
              className="relative"
              initial={{ opacity: 0, y: 40 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: phase === "revealing" ? [1, 1.1, 0.9] : 1,
              }}
              transition={{
                delay: index * 0.15,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span
                className={`text-7xl md:text-8xl font-extralight tracking-tighter transition-colors duration-500 ${
                  letter === "S" && progress >= 70
                    ? "text-sbi-green"
                    : "text-white"
                }`}
              >
                {letter}
              </span>
              <motion.div
                className="absolute inset-0 blur-xl bg-sbi-green/20"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: phase === "revealing" ? [0, 0.5, 0] : 0,
                }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.6,
                }}
              />
            </motion.div>
          ))}
        </div>

        <div className="relative w-48 md:w-64">
          <div className="h-px bg-sbi-dark-border w-full" />

          <motion.div
            className="absolute top-0 left-0 h-px bg-sbi-green origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: 0.1, ease: "linear" }}
          />

          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-sbi-green rounded-full"
            initial={{ left: 0 }}
            animate={{ left: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
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
            {Math.floor(progress)}%
          </motion.div>
        </div>
      </div>

      <CornerAccent position="top-left" delay={0.2} />
      <CornerAccent position="top-right" delay={0.3} />
      <CornerAccent position="bottom-left" delay={0.4} />
      <CornerAccent position="bottom-right" delay={0.5} />

      <motion.div
        className="absolute inset-0 bg-sbi-dark origin-top"
        initial={{ scaleY: 0 }}
        animate={{
          scaleY: phase === "revealing" ? 1 : 0,
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.div>
  );
}

function CornerAccent({
  position,
  delay,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  delay: number;
}) {
  const positionClasses = {
    "top-left": "top-8 left-8",
    "top-right": "top-8 right-8",
    "bottom-left": "bottom-8 left-8",
    "bottom-right": "bottom-8 right-8",
  };

  const isTop = position.includes("top");
  const isLeft = position.includes("left");

  return (
    <div className={`absolute w-16 h-16 ${positionClasses[position]}`}>
      <motion.div
        className={`absolute ${isTop ? "top-0" : "bottom-0"} ${isLeft ? "left-0" : "right-0"} w-full h-px bg-sbi-dark-border`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay, duration: 0.6 }}
      />
      <motion.div
        className={`absolute ${isTop ? "top-0" : "bottom-0"} ${isLeft ? "left-0" : "right-0"} h-full w-px bg-sbi-dark-border`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay, duration: 0.6 }}
      />
    </div>
  );
}
