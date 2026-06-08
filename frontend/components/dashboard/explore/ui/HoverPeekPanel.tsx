"use client";

import { type LucideIcon, PanelRightClose, Pin } from "lucide-react";
import { motion, type Variants } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Notion's sidebar feel: ease + duration lifted from its actual implementation.
const DEFAULT_WIDTH = 288; // matches w-72
const NOTION_EASE = [0.165, 0.84, 0.44, 1] as const;

// Three states, morphing the SAME element so float->dock tweens smoothly:
//  - hidden: parked off the right edge, transparent
//  - peek:   85%-height panel hugging the right edge; only the LEFT corners are
//            rounded (the right side sits on the edge), with a leftward shadow
//  - locked: docked flush full-height, square corners, no shadow
const panelVariants: Variants = {
  hidden: {
    // Translate fully past its own right edge so it clears even when the width
    // is capped to 90vw on narrow screens. 110% > any capped width.
    x: "110%",
    opacity: 0,
    top: "7.5%",
    bottom: "7.5%",
    right: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: "-10px 0 50px -12px rgba(0,0,0,0)",
  },
  peek: {
    x: 0,
    opacity: 1,
    top: "7.5%",
    bottom: "7.5%",
    right: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: "-10px 0 50px -12px rgba(0,0,0,0.7)",
  },
  locked: {
    x: 0,
    opacity: 1,
    top: "0%",
    bottom: "0%",
    right: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: "-10px 0 50px -12px rgba(0,0,0,0)",
  },
};

interface HoverPeekPanelProps {
  /** localStorage key for persisting the pinned preference. */
  storageKey: string;
  /** Header label (may include a live count, e.g. "Sources · 3"). */
  title: string;
  /** Icon shown on the collapsed right-edge tab handle. */
  icon: LucideIcon;
  /** Accessible label for the tab handle. */
  tabLabel: string;
  /** When true, the whole thing (panel + tab) is removed from the layout. */
  hidden?: boolean;
  width?: number;
  children: ReactNode;
}

/**
 * A right-edge panel that reveals on hover (floating peek) and docks on click
 * (locked). Reusable shell extracted from the original chat-history drawer: it
 * owns the pin/peek state, the discoverable edge tab, and the morph animation.
 * Callers supply the title, tab icon, and body content.
 */
export function HoverPeekPanel({
  storageKey,
  title,
  icon: Icon,
  tabLabel,
  hidden = false,
  width = DEFAULT_WIDTH,
  children,
}: HoverPeekPanelProps) {
  const [pinned, setPinned] = useState(false);
  const [peek, setPeek] = useState(false);
  // Hover-peek is a fine-pointer affordance only. On touch (coarse pointer) the
  // hover events never fire reliably, so we gate them off and let users tap the
  // edge handle to toggle the panel instead.
  const [canHover, setCanHover] = useState(true);
  const open = pinned || peek;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the pinned preference once on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setPinned(true);
    } catch {}
  }, [storageKey]);

  // Detect whether the primary pointer can hover (mouse/trackpad vs touch).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const openPeek = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPeek(true);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPeek(false), 180);
  }, [pinned]);

  const togglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {}
      if (!next) setPeek(false); // unpinning collapses
      return next;
    });
  };

  // No content to show -> remove the panel and its handle entirely. Placed after
  // all hooks so hook order stays stable.
  if (hidden) return null;

  const visualState = pinned ? "locked" : peek ? "peek" : "hidden";

  return (
    <>
      {/* Collapsed affordance: an always-visible tab on the right edge so the
          panel is discoverable. Hovering peeks it open; clicking locks it. A thin
          edge strip widens the hover target. Both hide once the panel is open. */}
      {!pinned && (
        <>
          {/* The right-edge handle. On fine pointers a tall invisible strip
              (::before) widens the hover target so the peek triggers a little
              before the cursor reaches the visible tab; on touch it's a plain
              tap target. It's the keyboard affordance too (focusable button,
              Enter/Space pin it open). */}
          <button
            type="button"
            onMouseEnter={canHover ? openPeek : undefined}
            onClick={togglePin}
            aria-label={tabLabel}
            aria-expanded={open}
            title={
              canHover
                ? `${title} — hover to peek, click to keep open`
                : `${title} — tap to open`
            }
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center rounded-l-xl border border-r-0 border-sbi-dark-border bg-sbi-dark-card py-4 pl-2.5 pr-2 text-sbi-muted shadow-lg shadow-black/30 transition-all duration-200 hover:text-sbi-green hover:pr-3",
              // Fine-pointer hover-target widener: an invisible full-height strip
              // along the right edge so the peek can trigger before the cursor
              // lands on the visible tab. No-op for touch.
              canHover &&
                "before:absolute before:top-1/2 before:right-0 before:h-screen before:max-h-[100vh] before:w-4 before:-translate-y-1/2 before:content-['']",
              open && "opacity-0 pointer-events-none translate-x-4",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* The panel. One element that morphs between floating-peek and docked-lock
          so the float->dock transition tweens (x, inset, radius, shadow) instead
          of snapping between class sets. */}
      <motion.aside
        onMouseEnter={canHover ? cancelClose : undefined}
        onMouseLeave={canHover ? scheduleClose : undefined}
        initial={false}
        animate={visualState}
        variants={panelVariants}
        transition={{ duration: 0.3, ease: NOTION_EASE }}
        style={{
          position: "absolute",
          // Cap to the viewport on narrow screens so the fixed 288px panel never
          // overflows; respects the requested width on roomy layouts.
          width: `min(${width}px, 90vw)`,
          zIndex: 40,
          pointerEvents: open ? "auto" : "none",
        }}
        className="flex flex-col overflow-hidden bg-sbi-dark border border-sbi-dark-border/50 border-t-sbi-dark-border/20"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <span className="px-1 text-white text-sm font-medium tracking-wide">
            {title}
          </span>
          <button
            type="button"
            onClick={togglePin}
            title={pinned ? "Close panel" : "Lock panel open"}
            aria-label={pinned ? "Close panel" : "Lock panel open"}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-sbi-muted-dark hover:text-white hover:bg-sbi-dark-card/60 transition-colors"
          >
            {pinned ? (
              <PanelRightClose className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Pin className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar">
          {children}
        </div>
      </motion.aside>
    </>
  );
}
