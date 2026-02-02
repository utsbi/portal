"use client";

import { AnimatePresence, motion } from "motion/react";
import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

interface ProjectImageHeroProps {
  images: StaticImageData[];
  title: string;
}

export function ProjectImageHero({ images, title }: ProjectImageHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cycleRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const CYCLE_DURATION = 6000;

  // Reset to first image when images change (project switch)
  const prevImagesRef = useRef(images);
  if (images !== prevImagesRef.current) {
    prevImagesRef.current = images;
    cycleRef.current += 1;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: synchronous reset during render
  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  // Unified timer: progress bar (via ref) + auto-advance
  // biome-ignore lint/correctness/useExhaustiveDependencies: cycleRef.current used as reset trigger
  useEffect(() => {
    if (images.length === 0) return;

    const cycle = cycleRef.current;
    let startTime: number | null = null;
    let frameId: number;

    const tick = (timestamp: number) => {
      if (cycleRef.current !== cycle) return;
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      if (elapsed >= CYCLE_DURATION) {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        return;
      }

      // Update progress bar directly via DOM ref — no React re-render
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(elapsed / CYCLE_DURATION) * 100}%`;
      }
      frameId = requestAnimationFrame(tick);
    };

    if (progressBarRef.current) {
      progressBarRef.current.style.width = "0%";
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [currentIndex, images.length]);

  const goToImage = useCallback((index: number) => {
    cycleRef.current += 1;
    setCurrentIndex(index);
  }, []);

  const goPrev = useCallback(() => {
    cycleRef.current += 1;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    cycleRef.current += 1;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  // Ken Burns variants - alternate between different pan directions
  const getKenBurnsVariant = (index: number) => {
    const variants = [
      { initial: { scale: 1, x: 0, y: 0 }, animate: { scale: 1.08, x: 20, y: 0 } },
      { initial: { scale: 1, x: 0, y: 0 }, animate: { scale: 1.08, x: -20, y: 0 } },
      { initial: { scale: 1, x: 0, y: 0 }, animate: { scale: 1.08, x: 15, y: -15 } },
      { initial: { scale: 1, x: 0, y: 0 }, animate: { scale: 1.08, x: -15, y: 15 } },
    ];
    return variants[index % variants.length];
  };

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-sbi-dark">
      {/* Image slideshow with Ken Burns effect */}
      <AnimatePresence mode="sync">
        {images.map((image, index) => {
          if (index !== currentIndex) return null;
          const kenBurns = getKenBurnsVariant(index);
          return (
            <motion.div
              key={image.src}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
            >
              <motion.div
                className="relative w-full h-full"
                initial={kenBurns.initial}
                animate={kenBurns.animate}
                transition={{ duration: CYCLE_DURATION / 1000, ease: "linear" }}
              >
                <Image
                  src={image}
                  alt={`${title} - Image ${index + 1}`}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(5, 8, 7, 0.6) 100%)",
        }}
      />

      {/* Bottom gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-sbi-dark via-sbi-dark/40 to-transparent pointer-events-none" />

      {/* Navigation arrows + dot indicators */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
        <button
          type="button"
          onClick={goPrev}
          className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          aria-label="Previous image"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => goToImage(index)}
              className="group relative w-2 h-2 rounded-full transition-all duration-300"
              aria-label={`Go to image ${index + 1}`}
            >
              <div
                className={`w-full h-full rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-sbi-green scale-125"
                    : "bg-white/30 group-hover:bg-white/50"
                }`}
              />
              {index === currentIndex && (
                <motion.div
                  className="absolute inset-0 bg-sbi-green/30 rounded-full"
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.8, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          aria-label="Next image"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Progress bar — updated via ref, not state */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sbi-dark-border z-10">
        <div ref={progressBarRef} className="h-full bg-sbi-green origin-left" style={{ width: "0%" }} />
      </div>
    </div>
  );
}
