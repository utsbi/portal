"use client";

import { motion } from "motion/react";
import { BlueprintGrid } from "./blueprint-grid";

interface PageHeroProps {
  label: string;
  title: string;
  subtitle?: string;
}

export function PageHero({ label, title, subtitle }: PageHeroProps) {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] w-full overflow-hidden flex items-center">
      <div className="absolute inset-0 bg-sbi-dark">
        <BlueprintGrid />
        <div className="absolute inset-0 bg-linear-to-b from-sbi-dark/50 via-transparent to-sbi-dark" />
      </div>

      <div className="absolute top-1/4 right-0 w-96 h-96 pointer-events-none opacity-20">
        <svg
          viewBox="0 0 400 400"
          fill="none"
          className="w-full h-full"
          aria-hidden="true"
        >
          <title>Decorative lines</title>
          <line
            x1="0"
            y1="400"
            x2="400"
            y2="0"
            stroke="url(#hero-gradient)"
            strokeWidth="1"
          />
          <line
            x1="50"
            y1="400"
            x2="400"
            y2="50"
            stroke="url(#hero-gradient)"
            strokeWidth="0.5"
          />
          <line
            x1="100"
            y1="400"
            x2="400"
            y2="100"
            stroke="url(#hero-gradient)"
            strokeWidth="0.5"
          />
          <defs>
            <linearGradient
              id="hero-gradient"
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="1" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 pt-32 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-4 mb-8"
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-16 h-px bg-sbi-green origin-left"
          />
          <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
            {label}
          </span>
        </motion.div>

        <div className="overflow-hidden">
          <motion.h1
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{
              delay: 0.2,
              duration: 1,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight tracking-tighter text-white"
          >
            {title}
          </motion.h1>
        </div>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.5,
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-6 text-lg md:text-xl text-sbi-muted font-light max-w-2xl leading-relaxed"
          >
            {subtitle}
          </motion.p>
        )}

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 w-24 h-px bg-sbi-green/50 origin-left"
        />
      </div>
    </section>
  );
}
