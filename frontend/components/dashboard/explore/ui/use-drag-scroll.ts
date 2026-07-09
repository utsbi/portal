"use client";

import { type MouseEvent, type PointerEvent, useRef } from "react";

/**
 * Mouse drag-to-scroll for a horizontal overflow container. Attach `ref` to the
 * scrolling element and spread `dragHandlers` onto it. Click-and-drag then pans
 * `scrollLeft` the way shift+wheel does today.
 *
 * Only engages for `pointerType === "mouse"` so touch and trackpad keep their
 * native momentum scrolling. When a gesture actually moved past a small
 * threshold, the closing click is swallowed so a child button (e.g. a chip)
 * doesn't fire on drag-release.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const state = useRef({
    down: false,
    startX: 0,
    startScroll: 0,
    moved: false,
  });

  const onPointerDown = (e: PointerEvent<T>) => {
    // A fresh press begins a new gesture: clear any stale `moved` a prior drag
    // left set (e.g. one that ended via pointerleave with no closing click to
    // reset it), so it can't swallow this press's eventual click.
    state.current.moved = false;
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    // Nothing to pan — leave clicks alone.
    if (el.scrollWidth <= el.clientWidth) return;
    state.current = {
      down: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (e: PointerEvent<T>) => {
    const el = ref.current;
    if (!el || !state.current.down) return;
    const dx = e.clientX - state.current.startX;
    if (!state.current.moved && Math.abs(dx) > 4) {
      state.current.moved = true;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = "grabbing";
    }
    if (state.current.moved) el.scrollLeft = state.current.startScroll - dx;
  };

  // A grab cursor only makes sense while the row actually overflows.
  const applyRestCursor = (hovering: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.cursor = hovering && el.scrollWidth > el.clientWidth ? "grab" : "";
  };

  const onPointerEnter = (e: PointerEvent<T>) => {
    if (e.pointerType === "mouse") applyRestCursor(true);
  };

  const endDrag = (e: PointerEvent<T>) => {
    state.current.down = false;
    // On release, settle back to grab (still hovering); on leave, clear.
    applyRestCursor(e.type === "pointerup");
  };

  const onClickCapture = (e: MouseEvent<T>) => {
    if (!state.current.moved) return;
    // The gesture was a drag, not a click — don't let it reach the chip.
    e.preventDefault();
    e.stopPropagation();
    state.current.moved = false;
  };

  return {
    ref,
    dragHandlers: {
      onPointerEnter,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
    },
  } as const;
}
