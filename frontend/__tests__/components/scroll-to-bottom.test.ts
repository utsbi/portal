import { describe, expect, it } from "vitest";
import {
  distanceFromBottom,
  SCROLL_TO_BOTTOM_MIN_THRESHOLD,
  shouldShowScrollToBottom,
} from "@/components/dashboard/common/scroll-to-bottom";

describe("distanceFromBottom", () => {
  it("is 0 when scrolled exactly to the bottom", () => {
    expect(
      distanceFromBottom({
        scrollHeight: 1000,
        scrollTop: 400,
        clientHeight: 600,
      }),
    ).toBe(0);
  });

  it("measures how far above the bottom edge the viewport sits", () => {
    expect(
      distanceFromBottom({
        scrollHeight: 2000,
        scrollTop: 100,
        clientHeight: 600,
      }),
    ).toBe(1300);
  });

  it("clamps negative values (overscroll / rounding) to 0", () => {
    expect(
      distanceFromBottom({
        scrollHeight: 1000,
        scrollTop: 401,
        clientHeight: 600,
      }),
    ).toBe(0);
  });
});

describe("shouldShowScrollToBottom", () => {
  it("hides at the bottom", () => {
    expect(
      shouldShowScrollToBottom({
        scrollHeight: 3000,
        scrollTop: 2400,
        clientHeight: 600,
      }),
    ).toBe(false);
  });

  it("hides when scrolled up less than one viewport", () => {
    // 599px from the bottom with a 600px viewport — still "near".
    expect(
      shouldShowScrollToBottom({
        scrollHeight: 3000,
        scrollTop: 1801,
        clientHeight: 600,
      }),
    ).toBe(false);
  });

  it("shows once scrolled up more than one viewport", () => {
    // 601px from the bottom with a 600px viewport.
    expect(
      shouldShowScrollToBottom({
        scrollHeight: 3000,
        scrollTop: 1799,
        clientHeight: 600,
      }),
    ).toBe(true);
  });

  it("applies the minimum threshold in very short viewports", () => {
    // Viewport of 100px: one viewport up (150px) is NOT enough — the floor
    // keeps the button from flickering in on trivial scrolls.
    expect(
      shouldShowScrollToBottom({
        scrollHeight: 1000,
        scrollTop: 750,
        clientHeight: 100,
      }),
    ).toBe(false);
    // Beyond the floor it shows.
    expect(
      shouldShowScrollToBottom({
        scrollHeight: 1000,
        scrollTop: 1000 - 100 - (SCROLL_TO_BOTTOM_MIN_THRESHOLD + 1),
        clientHeight: 100,
      }),
    ).toBe(true);
  });

  it("never shows when content fits the viewport", () => {
    expect(
      shouldShowScrollToBottom({
        scrollHeight: 500,
        scrollTop: 0,
        clientHeight: 600,
      }),
    ).toBe(false);
  });
});
