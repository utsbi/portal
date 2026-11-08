export type DuesPeriod = {
  id: number;
  name: string;
  amount_cents: number;
  due_on: string;
  created_by: number | null;
  created_at: string;
};
export type DuesAccount = {
  id: number;
  period_id: number;
  profile_id: number;
  amount_cents: number;
  waived: boolean;
  waiver_reason: string | null;
  waiver_by: string | null;
  waiver_at: string | null;
  created_at: string;
};
export type DuesPayment = {
  id: number;
  account_id: number;
  request_id: string;
  amount_cents: number;
  paid_on: string | null;
  method: string | null;
  historical: boolean;
  note: string;
  recorded_by: string;
  recorded_at: string;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
};
export type DuesMember = {
  id: number;
  name: string;
  email: string | null;
  role: string;
};
export type DuesStatus = "Paid" | "Partial" | "Unpaid" | "Waived";
export const paymentMethods = [
  "Venmo",
  "Zelle",
  "Cash",
  "Check",
  "Other",
] as const;

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function parseCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000
    ? cents
    : null;
}

export function accountBalance(account: DuesAccount, payments: DuesPayment[]) {
  const paid = payments
    .filter((p) => p.account_id === account.id && !p.voided_at)
    .reduce((total, p) => total + p.amount_cents, 0);
  const balance = account.waived ? 0 : Math.max(0, account.amount_cents - paid);
  const status: DuesStatus = account.waived
    ? "Waived"
    : balance === 0
      ? "Paid"
      : paid > 0
        ? "Partial"
        : "Unpaid";
  return { paid, balance, status };
}

export function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function csvCell(value: string | number) {
  // Neutralize spreadsheet formulas, including names and externally supplied notes.
  const text = String(value);
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function duesCsv(
  period: DuesPeriod,
  accounts: DuesAccount[],
  members: DuesMember[],
  payments: DuesPayment[],
) {
  const rows: (string | number)[][] = [
    [
      "Period",
      "Member",
      "Email",
      "Due date",
      "Assessed (USD)",
      "Paid (USD)",
      "Balance (USD)",
      "Status",
    ],
  ];
  for (const account of accounts) {
    const member = members.find((m) => m.id === account.profile_id);
    const { paid, balance, status } = accountBalance(account, payments);
    rows.push([
      period.name,
      member?.name ?? "Unknown member",
      member?.email ?? "",
      period.due_on,
      (account.amount_cents / 100).toFixed(2),
      (paid / 100).toFixed(2),
      (balance / 100).toFixed(2),
      status,
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
