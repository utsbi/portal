/**
 * Master–detail switching for the messages shell (MessagesPanes).
 *
 * The active conversation lives in the URL (`/dashboard/messages/[conversationId]`),
 * so pane visibility below the `md` breakpoint is driven purely by `useParams()`:
 * - no conversation → list pane visible, detail pane hidden (until md)
 * - conversation    → detail pane visible, list pane hidden (until md)
 * Both panes must stay mounted in all cases (the layout relies on the list and
 * DetailPane mounting exactly once).
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagesPanes } from "@/app/dashboard/messages/MessagesPanes";

const useParamsMock = vi.hoisted(() =>
  vi.fn<() => { conversationId?: string }>(() => ({})),
);

vi.mock("next/navigation", () => ({
  useParams: useParamsMock,
}));

function renderPanes() {
  return render(
    <MessagesPanes
      list={<div data-testid="list-content">list</div>}
      detail={<div data-testid="detail-content">detail</div>}
    />,
  );
}

function paneOf(testId: string): HTMLElement {
  const pane = screen.getByTestId(testId).parentElement;
  if (!pane) throw new Error(`pane wrapper missing for ${testId}`);
  return pane;
}

afterEach(() => {
  useParamsMock.mockReset();
  useParamsMock.mockReturnValue({});
});

describe("MessagesPanes master–detail switching", () => {
  it("shows the full-width list and hides the detail pane when no conversation is selected", () => {
    useParamsMock.mockReturnValue({});
    renderPanes();

    const listPane = paneOf("list-content");
    const detailPane = paneOf("detail-content");

    // List: full-width on mobile, fixed-width column from md up.
    expect(listPane.classList.contains("w-full")).toBe(true);
    expect(listPane.classList.contains("md:w-96")).toBe(true);
    expect(listPane.classList.contains("hidden")).toBe(false);

    // Detail: hidden on mobile, restored from md up.
    expect(detailPane.classList.contains("hidden")).toBe(true);
    expect(detailPane.classList.contains("md:flex")).toBe(true);
  });

  it("shows the detail pane and hides the list on mobile when a conversation is selected", () => {
    useParamsMock.mockReturnValue({ conversationId: "42" });
    renderPanes();

    const listPane = paneOf("list-content");
    const detailPane = paneOf("detail-content");

    // List: hidden on mobile, two-pane layout unchanged from md up.
    expect(listPane.classList.contains("hidden")).toBe(true);
    expect(listPane.classList.contains("md:block")).toBe(true);
    expect(listPane.classList.contains("md:w-96")).toBe(true);

    // Detail: visible flex column.
    expect(detailPane.classList.contains("flex")).toBe(true);
    expect(detailPane.classList.contains("hidden")).toBe(false);
  });

  it("keeps both panes mounted regardless of selection (visibility only)", () => {
    useParamsMock.mockReturnValue({ conversationId: "42" });
    renderPanes();

    // Hidden via CSS class, but still in the DOM.
    expect(screen.getByTestId("list-content")).toBeInTheDocument();
    expect(screen.getByTestId("detail-content")).toBeInTheDocument();
  });
});
