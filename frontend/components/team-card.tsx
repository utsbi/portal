"use client";

import { Mail } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import Image from "next/image";
import { useRef } from "react";

interface TeamCardProps {
  name: string;
  role: string;
  email: string;
  imageSrc?: string | null;
  index: number;
}

export function TeamCard({
  name,
  role,
  email,
  imageSrc,
  index,
}: TeamCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ once: true, margin: "-50px" }}
      onMouseMove={handleMouseMove}
      className="group relative"
    >
      <motion.div
        className="absolute -inset-px rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              rgba(34, 197, 94, 0.1),
              transparent 70%
            )
          `,
        }}
      />

      <div className="relative bg-sbi-dark-card border border-sbi-dark-border hover:border-sbi-green/30 transition-colors duration-500 overflow-hidden">
        <div className="aspect-3/4 relative overflow-hidden">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={`${name}, ${role}`}
              fill
              className="object-cover brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-700"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-sbi-dark-card flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-full border border-sbi-dark-border flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="w-10 h-10 text-sbi-dark-border"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span className="text-xs tracking-[0.2em] uppercase select-none text-sbi-muted/60">
                Portrait Coming Soon
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-sbi-dark via-sbi-dark/20 to-transparent" />
        </div>

        <div className="relative p-6">
          <h3 className="text-xl font-light text-white mb-1 tracking-tight">
            {name}
          </h3>
          <p className="text-sm text-sbi-green/80 mb-4">{role}</p>

          <motion.a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-2 text-xs text-sbi-muted hover:text-white transition-colors duration-300"
            whileHover={{ x: 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span className="w-6 h-6 flex items-center justify-center border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-300">
              <Mail className="w-3 h-3" />
            </span>
            <span className="tracking-wide">{email}</span>
          </motion.a>
        </div>

        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-sbi-green"
          initial={{ width: 0 }}
          whileInView={{ width: "100%" }}
          transition={{
            delay: 0.3 + index * 0.1,
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
          viewport={{ once: true }}
        />
      </div>
    </motion.div>
  );
}
