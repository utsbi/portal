"use client";

import gsap from "gsap";
import {
  Clock,
  DollarSign,
  FileText,
  type LucideIcon,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listIndexedFiles } from "@/lib/api/knowledge";
import { useChat } from "@/lib/chat/chat-context";
import { useProject } from "@/lib/project/project-context";

interface Suggestion {
  icon: LucideIcon;
  text: string;
}

const defaultSuggestions: Suggestion[] = [
  { icon: TrendingUp, text: "Progress updates" },
  { icon: DollarSign, text: "Budget summary" },
  { icon: Clock, text: "Current Project blockers" },
];

interface SuggestionChipsProps {
  disableAutoAnimation?: boolean;
}

export function SuggestionChips({
  disableAutoAnimation = false,
}: SuggestionChipsProps) {
  const chipsRef = useRef<HTMLDivElement>(null);
  const { sendMessage, isLoading } = useChat();
  const { activeProject } = useProject();
  const projectId = activeProject?.projectId ?? null;

  // Grounded starters: when the project has indexed documents, lead with a
  // suggestion that names a real file — a concrete question teaches users the
  // assistant can search THEIR documents, which static chips never convey.
  const [suggestions, setSuggestions] =
    useState<Suggestion[]>(defaultSuggestions);
  const grounded = useRef(false);

  useEffect(() => {
    grounded.current = false;
    setSuggestions(defaultSuggestions);
    if (projectId === null) return;
    let cancelled = false;
    listIndexedFiles(projectId)
      .then((files) => {
        if (cancelled || files.length === 0) return;
        const filename = files[0].storage_path.split("/").pop();
        if (!filename) return;
        grounded.current = true;
        setSuggestions([
          { icon: FileText, text: `Summarize ${filename}` },
          ...defaultSuggestions.slice(0, 2),
        ]);
      })
      .catch(() => {
        // Non-critical: static suggestions remain.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (disableAutoAnimation) return;
    if (!chipsRef.current) return;

    const chips = chipsRef.current.querySelectorAll(".suggestion-chip");

    gsap.set(chips, { opacity: 0, y: 15, scale: 0.95 });

    const ctx = gsap.context(() => {
      gsap.to(chips, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        delay: 1,
        stagger: 0.1,
        ease: "power3.out",
      });
    }, chipsRef);

    return () => ctx.revert();
  }, [disableAutoAnimation]);

  // The grounded chip mounts AFTER the entrance animation (async fetch), so it
  // would keep the pre-animation hidden classes forever. Force it visible;
  // autoAlpha clears both opacity and the Tailwind `invisible` class.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when chips re-render
  useEffect(() => {
    if (!grounded.current || !chipsRef.current) return;
    const chips = chipsRef.current.querySelectorAll(".suggestion-chip");
    gsap.to(chips, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.4,
      ease: "power3.out",
    });
  }, [suggestions]);

  return (
    <div
      ref={chipsRef}
      className="flex flex-wrap items-center justify-center gap-3"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.text}
          type="button"
          onClick={() => {
            if (isLoading) return;
            void sendMessage(suggestion.text);
          }}
          disabled={isLoading}
          className="suggestion-chip invisible opacity-0 translate-y-4 scale-95 group relative overflow-hidden rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Background layers */}
          <div className="absolute inset-0 bg-sbi-dark-card/60 backdrop-blur-sm transition-all duration-500 group-hover:bg-sbi-dark-card rounded-full" />
          <div className="absolute inset-0 bg-linear-to-r from-sbi-green/0 via-sbi-green/5 to-sbi-green/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-full" />

          {/* Border */}
          <div className="absolute inset-0 border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-500 rounded-full" />

          {/* Content */}
          <div className="relative flex items-center gap-3 px-6 py-3">
            <suggestion.icon
              className="w-4 h-4 text-sbi-muted group-hover:text-sbi-green transition-colors duration-300"
              strokeWidth={1.5}
            />
            <span className="text-sm font-light tracking-wide text-sbi-muted group-hover:text-white transition-colors duration-300">
              {suggestion.text}
            </span>
          </div>

          {/* Bottom glow indicator on hover */}
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[inset_0_-1px_0_0_rgba(34,197,94,0.3)]" />
        </button>
      ))}
    </div>
  );
}
