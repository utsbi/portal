import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuesCharts } from "@/components/dashboard/admin/DuesCharts";
import type { DuesAccount, DuesPayment } from "@/lib/dues";

const { reducedMotion } = vi.hoisted(() => ({
  reducedMotion: vi.fn(() => false),
}));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: reducedMotion,
}));
const accounts: DuesAccount[] = [1, 2].map((id) => ({
  id,
  profile_id: id,
  period_id: 1,
  amount_cents: 3000,
  waived: false,
  waiver_reason: null,
  waiver_by: null,
  waiver_at: null,
  created_at: "2026-01-01",
}));
const historical: DuesPayment = {
  id: 1,
  account_id: 1,
  amount_cents: 3000,
  paid_on: null,
  method: null,
  historical: true,
  request_id: "1",
  note: "",
  recorded_by: "Director",
  recorded_at: "2026-11-01",
  voided_at: null,
  voided_by: null,
  void_reason: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  reducedMotion.mockReturnValue(false);
});

describe("Dues graphs", () => {
  it("shows just the two retained charts without leaked table captions", () => {
    render(<DuesCharts accounts={accounts} payments={[historical]} />);
    expect(
      screen.getByRole("heading", { name: "Member status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Payment methods" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Collections over time" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: "1 of 2 members paid in full" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unknown includes historical payments without a recorded method.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Payment method totals")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("displays method amounts and shares without hover or a hidden table", () => {
    render(
      <DuesCharts
        accounts={accounts}
        payments={[
          { ...historical, method: "Zelle" },
          {
            ...historical,
            id: 2,
            account_id: 2,
            amount_cents: 1000,
            method: "Cash",
          },
        ]}
      />,
    );
    const figure = screen.getByRole("figure", {
      name: "Collected amount by payment method",
    });
    expect(within(figure).getByText("Zelle")).toBeInTheDocument();
    expect(within(figure).getByText("$30.00")).toBeInTheDocument();
    expect(within(figure).getByText("75%")).toBeInTheDocument();
    expect(within(figure).getByText("25%")).toBeInTheDocument();
    expect(
      within(figure).queryByText(/Unknown includes/),
    ).not.toBeInTheDocument();
  });

  it("reveals fixed slices sequentially with one counterclockwise mask", () => {
    const { container } = render(
      <DuesCharts accounts={accounts} payments={[historical]} />,
    );
    const mask = container.querySelector("mask");
    expect(mask?.querySelectorAll("circle")).toHaveLength(1);
    expect(mask?.querySelector("g")).toHaveAttribute(
      "transform",
      "translate(88 88) rotate(-90) scale(1 -1)",
    );
    expect(mask?.querySelector("circle")).toHaveAttribute(
      "stroke-dashoffset",
      String(2 * Math.PI * 67),
    );
    // Both fixed slices are behind the same mask, not independently animated.
    expect(container.querySelectorAll("g[mask] circle")).toHaveLength(2);
    expect(container.querySelector("g[mask] circle")).toHaveAttribute(
      "stroke-dashoffset",
      "-2",
    );
  });

  it("respects reduced-motion preferences", () => {
    reducedMotion.mockReturnValue(true);
    const { container } = render(
      <DuesCharts accounts={accounts} payments={[historical]} />,
    );
    expect(container.querySelector("mask circle")).toHaveAttribute(
      "stroke-dashoffset",
      "0",
    );
  });

  it("handles a new period without drawing fabricated data", () => {
    render(<DuesCharts accounts={[]} payments={[]} />);
    expect(screen.getByText("No members assigned.")).toBeInTheDocument();
    expect(screen.getByText("No payments recorded.")).toBeInTheDocument();
  });
});
