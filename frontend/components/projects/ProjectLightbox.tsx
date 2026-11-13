"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion } from "motion/react";
import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ProjectLightboxProps {
  images: StaticImageData[];
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const SWIPE_THRESHOLD_PX = 40;

export function ProjectLightbox({
  images,
  index,
  title,
  onIndexChange,
  onClose,
}: ProjectLightboxProps) {
  const total = images.length;
  const touchStartX = useRef<number | null>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndexChange((index + 1) % total);
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + total) % total);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, total, onClose, onIndexChange]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: index is the trigger that keeps the active thumbnail in view
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} gallery`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex flex-col bg-sbi-dark/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
        <span className="font-mono text-xs tracking-widest text-sbi-muted">
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
        <span className="hidden min-w-0 truncate text-sm text-white/80 sm:block">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 hover:text-sbi-green"
        >
          <X size={22} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <button
          type="button"
          aria-label="Close gallery"
          tabIndex={-1}
          onClick={onClose}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null) return;
            const delta = event.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
            event.preventDefault();
            onIndexChange((index + (delta < 0 ? 1 : -1) + total) % total);
          }}
          className="absolute inset-0 cursor-zoom-out"
        />
        <motion.div
          key={images[index].src}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none absolute inset-x-4 inset-y-0 md:inset-x-20"
        >
          <Image
            src={images[index]}
            alt={`${title} — image ${index + 1} of ${total}`}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </motion.div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => onIndexChange((index - 1 + total) % total)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-sbi-dark/70 text-white backdrop-blur-sm transition-colors hover:border-sbi-green/50 hover:text-sbi-green md:left-6"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => onIndexChange((index + 1) % total)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-sbi-dark/70 text-white backdrop-blur-sm transition-colors hover:border-sbi-green/50 hover:text-sbi-green md:right-6"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="custom-scrollbar flex gap-2 overflow-x-auto px-4 py-3 md:justify-center md:px-8">
          {images.map((image, thumbIndex) => (
            <button
              key={image.src}
              ref={thumbIndex === index ? activeThumbRef : undefined}
              type="button"
              onClick={() => onIndexChange(thumbIndex)}
              aria-label={`Show image ${thumbIndex + 1}`}
              aria-current={thumbIndex === index ? "true" : undefined}
              className={cn(
                "relative h-12 w-16 shrink-0 overflow-hidden rounded-sm border transition-all",
                thumbIndex === index
                  ? "border-sbi-green opacity-100"
                  : "border-transparent opacity-50 hover:opacity-100",
              )}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
