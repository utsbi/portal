import { describe, expect, it } from "vitest";
import {
  accountBalance,
  csvCell,
  type DuesAccount,
  type DuesPayment,
  duesCsv,
  isDate,
  parseCents,
} from "@/lib/dues";
import { type DuesCommand, validateDuesCommand } from "@/lib/dues-validation";

const account: DuesAccount = {
  id: 1,
  period_id: 1,
  profile_id: 1,
  amount_cents: 5000,
  waived: false,
  waiver_reason: null,
  waiver_by: null,
  waiver_at: null,
  created_at: "2026-01-01",
};
const payment: DuesPayment = {
  id: 1,
  account_id: 1,
  request_id: "d2df01a9-fd08-4624-a370-9c56e37c8234",
  amount_cents: 2000,
  paid_on: "2026-01-01",
  historical: false,
  method: "Cash",
  note: "",
  recorded_by: "Director",
  recorded_at: "2026-01-01",
  void_reason: null,
  voided_by: null,
  voided_at: null,
};

describe("dues arithmetic and export", () => {
  it.each([
    ["50", 5000],
    ["0.01", 1],
    ["12.30", 1230],
    ["0.29", 29],
    ["1000000", 100000000],
    ["1.234", null],
    ["0", null],
    ["-10", null],
    ["1e3", null],
    ["Infinity", null],
    ["1000001", null],
    ["", null],
  ])("parses %s as integer cents", (input, expected) => {
    expect(parseCents(input as string)).toBe(expected);
  });
  it("calculates unpaid, partial, paid, and waived balances", () => {
    expect(accountBalance(account, [])).toEqual({
      paid: 0,
      balance: 5000,
      status: "Unpaid",
    });
    expect(accountBalance(account, [payment])).toEqual({
      paid: 2000,
      balance: 3000,
      status: "Partial",
    });
    expect(
      accountBalance(account, [{ ...payment, amount_cents: 5000 }]),
    ).toEqual({ paid: 5000, balance: 0, status: "Paid" });
    expect(accountBalance({ ...account, waived: true }, [])).toEqual({
      paid: 0,
      balance: 0,
      status: "Waived",
    });
  });
  it("excludes voided and other members' payments", () => {
    expect(
      accountBalance(account, [
        { ...payment, voided_at: "2026-01-02" },
        { ...payment, account_id: 2 },
      ]).paid,
    ).toBe(0);
  });
  it("escapes CSV and neutralizes formula injection", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("  =HYPERLINK(1)")).toBe('"\'  =HYPERLINK(1)"');
    expect(csvCell("+1")).toBe('"\'+1"');
    const csv = duesCsv(
      {
        id: 1,
        name: "Fall",
        amount_cents: 5000,
        due_on: "2026-01-01",
        created_by: 1,
        created_at: "2026-01-01",
      },
      [account],
      [{ id: 1, name: "Jane", email: "j@example.com", role: "member" }],
      [payment],
    );
    expect(csv).toContain('"50.00","20.00","30.00","Partial"');
  });
  it("rejects calendar-invalid dates", () => {
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026-02-28")).toBe(true);
  });
});

describe("dues validation", () => {
  const command: DuesCommand = {
    action: "record_payment",
    account_id: 1,
    request_id: payment.request_id,
    amount_cents: 2000,
    paid_on: "2020-01-01",
    method: "Cash",
    note: "Backfilled payment",
  };
  it("accepts historical payments", () =>
    expect(validateDuesCommand(command)).toBeNull());
  it.each([
    { amount_cents: 0 },
    { amount_cents: 0.1 },
    { amount_cents: -10 },
    { amount_cents: NaN },
    { paid_on: "2999-01-01" },
    { paid_on: "2026-02-30" },
    { account_id: -1 },
    { method: "Credit card" },
    { request_id: "not-a-uuid" },
    { note: "x".repeat(1001) },
  ])("rejects invalid payment patch %j", (patch) => {
    expect(
      validateDuesCommand({ ...command, ...patch } as DuesCommand),
    ).toBeTruthy();
  });
  it("requires selected members for periods", () => {
    expect(
      validateDuesCommand({
        action: "create_period",
        request_id: "00000000-0000-4000-8000-000000000010",
        name: "Fall",
        amount_cents: 5000,
        due_on: "2026-01-01",
        profile_ids: [],
      }),
    ).toBeTruthy();
  });
  it("validates bulk paid selections and retry keys", () => {
    const base: DuesCommand = {
      action: "assign_members",
      request_id: payment.request_id,
      period_id: 1,
      profile_ids: [1, 2],
      paid_profile_ids: [1],
    };
    expect(validateDuesCommand(base)).toBeNull();
    expect(
      validateDuesCommand({ ...base, paid_profile_ids: [3] }),
    ).toBeTruthy();
    expect(
      validateDuesCommand({ ...base, paid_profile_ids: [-1] }),
    ).toBeTruthy();
    expect(validateDuesCommand({ ...base, request_id: "" })).toBeTruthy();
    expect(
      validateDuesCommand({
        action: "mark_paid",
        request_id: payment.request_id,
        period_id: 1,
        profile_ids: [1],
      }),
    ).toBeNull();
    expect(
      validateDuesCommand({
        action: "mark_paid",
        request_id: payment.request_id,
        period_id: 1,
        profile_ids: [],
      }),
    ).toBeTruthy();
  });
  it("counts historical payments with unknown dates and methods normally", () => {
    expect(
      accountBalance(account, [
        {
          ...payment,
          amount_cents: 5000,
          paid_on: null,
          method: null,
          historical: true,
        },
      ]),
    ).toEqual({ paid: 5000, balance: 0, status: "Paid" });
  });
  it("requires a reason for waivers, restorations, and corrections", () => {
    expect(
      validateDuesCommand({
        action: "set_waiver",
        account_id: 1,
        waived: true,
        reason: " ",
      }),
    ).toBeTruthy();
    expect(
      validateDuesCommand({
        action: "set_waiver",
        account_id: 1,
        waived: false,
        reason: " ",
      }),
    ).toBeTruthy();
    expect(
      validateDuesCommand({
        action: "void_payment",
        payment_id: 1,
        reason: " ",
      }),
    ).toBeTruthy();
  });
  it("rejects unknown actions", () =>
    expect(
      validateDuesCommand({
        action: "delete_everything",
      } as unknown as DuesCommand),
    ).toBeTruthy());
});
