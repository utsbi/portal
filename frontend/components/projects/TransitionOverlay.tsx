"use client";

import { AnimatePresence, motion } from "motion/react";

interface TransitionOverlayProps {
  isVisible: boolean;
  duration?: number;
  children?: React.ReactNode;
}

export function TransitionOverlay({
  isVisible,
  duration = 300,
  children,
}: TransitionOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration / 1000 }}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-8"
          style={{ pointerEvents: isVisible ? "auto" : "none" }}
        >
          <div className="absolute inset-0 bg-black" />
          {children && <div className="relative z-10">{children}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
