"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useMotionValue } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);

interface MagneticButtonProps {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
  external?: boolean;
}

// Magnetic button with hover effects
export function MagneticButton({
  children,
  href,
  variant = "primary",
  external = false,
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const isPrimary = variant === "primary";
  const isInternal = !external && href.startsWith("/");

  const sharedClassName = cn(
    "relative inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-wider uppercase",
    "overflow-hidden group transition-colors duration-500",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green focus-visible:ring-offset-2 focus-visible:ring-offset-sbi-dark",
    isPrimary
      ? "bg-sbi-dark-btn text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark-btn"
      : "bg-transparent text-white border border-white/30 hover:bg-white hover:text-sbi-dark-btn",
  );

  const sharedMotionProps = {
    style: { x, y },
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    className: sharedClassName,
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 400, damping: 25 },
  } as const;

  const content = (
    <>
      <span className="relative z-10">{children}</span>
      <ArrowUpRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </>
  );

  if (isInternal) {
    return (
      <MotionLink ref={ref} href={href} {...sharedMotionProps}>
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...sharedMotionProps}
    >
      {content}
    </motion.a>
  );
}
