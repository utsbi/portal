/**
 * Shared logic for the floating "scroll to bottom" affordance used by the
 * Explore chat and the Messages thread. Kept as pure functions so the
 * threshold behavior is unit-testable without a real scroll container.
 */

/** Minimum distance (px) that always counts as "scrolled up", even in very
 *  short viewports where a fraction of the viewport would be tiny. */
export const SCROLL_TO_BOTTOM_MIN_THRESHOLD = 240;

export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** Distance (px) between the current scroll position and the bottom edge. */
export function distanceFromBottom(metrics: ScrollMetrics): number {
  return Math.max(
    0,
    metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight,
  );
}

/**
 * Show the affordance only once the user is roughly a viewport (or more) away
 * from the latest message — closer than that, the bottom is a flick away and
 * the button would just be noise over the last bubble.
 */
export function shouldShowScrollToBottom(metrics: ScrollMetrics): boolean {
  const threshold = Math.max(
    SCROLL_TO_BOTTOM_MIN_THRESHOLD,
    metrics.clientHeight,
  );
  return distanceFromBottom(metrics) > threshold;
}
