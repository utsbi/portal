import { describe, expect, it } from "vitest";
import type { DuesAccount, DuesPayment } from "@/lib/dues";
import { buildDuesCharts } from "@/lib/dues-charts";

const account = (id: number, waived = false): DuesAccount => ({
  id,
  period_id: 1,
  profile_id: id,
  amount_cents: 3000,
  waived,
  waiver_reason: null,
  waiver_by: null,
  waiver_at: null,
  created_at: "2026-01-01",
});
const payment = (
  id: number,
  patch: Partial<DuesPayment> = {},
): DuesPayment => ({
  id,
  account_id: 1,
  amount_cents: 3000,
  paid_on: "2026-01-02",
  method: "Cash",
  historical: false,
  request_id: String(id),
  note: "",
  recorded_by: "Director",
  recorded_at: "2026-11-01",
  voided_at: null,
  voided_by: null,
  void_reason: null,
  ...patch,
});

describe("dues chart data", () => {
  it("groups member status, counting waived members separately", () => {
    const data = buildDuesCharts(
      [account(1), account(2), account(3), account(4, true)],
      [payment(1), payment(2, { account_id: 2, amount_cents: 1000 })],
    );
    expect(data.statuses.map((s) => [s.name, s.count])).toEqual([
      ["Paid", 1],
      ["Partial", 1],
      ["Unpaid", 1],
      ["Waived", 1],
    ]);
  });

  it("combines payments by method using integer cents", () => {
    const data = buildDuesCharts(
      [account(1)],
      [
        payment(1, { paid_on: "2026-03-01", amount_cents: 1000 }),
        payment(2, { paid_on: "2026-01-01", amount_cents: 500 }),
        payment(3, { paid_on: "2026-03-01", amount_cents: 1500 }),
      ],
    );
    expect(data.methods).toEqual([{ name: "Cash", amount: 3000 }]);
    expect(data.collected).toBe(3000);
  });

  it("does not invent payment dates or methods for historical entries", () => {
    const data = buildDuesCharts(
      [account(1), account(2)],
      [
        payment(1, { paid_on: null, method: null, historical: true }),
        payment(2, { account_id: 2, amount_cents: 500, method: "Venmo" }),
      ],
    );
    expect(data.collected).toBe(3500);
    expect(data.methods).toEqual([
      { name: "Unknown", amount: 3000 },
      { name: "Venmo", amount: 500 },
    ]);
  });

  it("excludes corrections and payments belonging to another period", () => {
    const data = buildDuesCharts(
      [account(1)],
      [
        payment(1, { voided_at: "2026-01-03" }),
        payment(2, { account_id: 99 }),
        payment(3, { amount_cents: 100 }),
      ],
    );
    expect(data.collected).toBe(100);
    expect(data.methods).toEqual([{ name: "Cash", amount: 100 }]);
    expect(data.statuses.find((s) => s.name === "Partial")?.count).toBe(1);
  });

  it("handles empty periods and undated-only collections", () => {
    expect(buildDuesCharts([], []).methods).toEqual([]);
    expect(buildDuesCharts([], []).collected).toBe(0);
    const data = buildDuesCharts(
      [account(1)],
      [payment(1, { paid_on: null, method: null, historical: true })],
    );
    expect(data.methods).toEqual([{ name: "Unknown", amount: 3000 }]);
    expect(data.collected).toBe(3000);
    expect(data.statuses.find((s) => s.name === "Paid")?.count).toBe(1);
  });
});
