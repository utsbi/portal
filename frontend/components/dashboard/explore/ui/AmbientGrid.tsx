'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function AmbientGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;

    const ctx = gsap.context(() => {
      // Subtle pulse animation on grid nodes
      const nodes = gridRef.current?.querySelectorAll('.grid-node');
      if (nodes && nodes.length > 0) {
        gsap.to(nodes, {
          opacity: 0.15,
          duration: 2,
          stagger: {
            each: 0.5,
            repeat: -1,
            yoyo: true,
            from: 'random',
          },
          ease: 'sine.inOut',
        });
      }
    }, gridRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={gridRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Blueprint grid pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.015]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <title>Ambient grid</title>
        <defs>
          <pattern
            id="dashboard-grid-small"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-sbi-green"
            />
          </pattern>
          <pattern
            id="dashboard-grid-large"
            width="200"
            height="200"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 200 0 L 0 0 0 200"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-sbi-green"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dashboard-grid-small)" />
        <rect width="100%" height="100%" fill="url(#dashboard-grid-large)" />
      </svg>

      {/* Animated grid intersection nodes */}
      <div className="absolute inset-0">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="grid-node absolute w-1 h-1 bg-sbi-green rounded-full opacity-0"
            style={{
              top: `${20 + Math.random() * 60}%`,
              left: `${10 + Math.random() * 80}%`,
            }}
          />
        ))}
      </div>

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent via-transparent to-sbi-dark/80" />
    </div>
  );
}
