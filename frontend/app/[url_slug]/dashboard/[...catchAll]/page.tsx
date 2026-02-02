"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CatchAllPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const urlSlug = (params.url_slug as string) || "dev_test";

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const elements = containerRef.current?.querySelectorAll(".animate-in");
      if (!elements) return;

      gsap.to(elements, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.1,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-sbi-dark"
    >
      {/* Background elements */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl" />

      {/* Corner accents */}
      <div className="absolute top-8 left-8 w-24 h-24 border-l border-t border-sbi-dark-border/40" />
      <div className="absolute bottom-8 right-8 w-24 h-24 border-r border-b border-sbi-dark-border/40" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 px-4">
        {/* 404 Number */}
        <div className="animate-in opacity-0 translate-y-5">
          <span className="text-8xl md:text-9xl font-extralight tracking-tight text-sbi-green/80">
            404
          </span>
        </div>

        {/* Message */}
        <div className="animate-in opacity-0 translate-y-5 space-y-3">
          <h1 className="text-2xl md:text-3xl font-extralight tracking-tight text-white">
            Page Not Found :(
          </h1>
          <p className="text-base md:text-lg font-light text-sbi-muted tracking-wide max-w-md">
            The page you&apos;re looking for doesn&apos;t exist
          </p>
        </div>

        {/* Decorative Section */}
        <div className="animate-in opacity-0 translate-y-5 w-24 h-px bg-linear-to-r from-transparent via-sbi-green/50 to-transparent" />

        {/* Return button */}
        <div className="animate-in opacity-0 translate-y-5">
          <Link
            href={`/${urlSlug}/dashboard`}
            className="group relative inline-flex items-center gap-3 px-8 py-4 overflow-hidden rounded-full"
          >
            {/* Background layers */}
            <div className="absolute inset-0 bg-sbi-dark-card/60 backdrop-blur-sm transition-all duration-500 group-hover:bg-sbi-dark-card rounded-full" />
            <div className="absolute inset-0 bg-linear-to-r from-sbi-green/0 via-sbi-green/5 to-sbi-green/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-full" />

            {/* Border */}
            <div className="absolute inset-0 border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-500 rounded-full" />

            {/* Content */}
            <span className="relative text-sm font-extralight tracking-wide text-sbi-muted group-hover:text-white transition-colors duration-300">
              Return to Dashboard
            </span>

            {/* Bottom glow on hover */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[inset_0_-1px_0_0_rgba(34,197,94,0.3)]" />
          </Link>
        </div>
      </div>

      {/* Bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sbi-dark-border/30 to-transparent" />
    </div>
  );
}
