import {
  accountBalance,
  type DuesAccount,
  type DuesPayment,
  type DuesStatus,
} from "@/lib/dues";

export const statusColors: Record<DuesStatus, string> = {
  Paid: "#22c55e",
  Partial: "#eab308",
  Unpaid: "#64748b",
  Waived: "#93c5fd",
};

export function buildDuesCharts(
  accounts: DuesAccount[],
  payments: DuesPayment[],
) {
  const ids = new Set(accounts.map((a) => a.id));
  const active = payments.filter((p) => ids.has(p.account_id) && !p.voided_at);
  const statuses = (["Paid", "Partial", "Unpaid", "Waived"] as const).map(
    (name) => ({
      name,
      count: 0,
      color: statusColors[name],
    }),
  );
  for (const account of accounts) {
    const status = accountBalance(account, active).status;
    const bucket = statuses.find((s) => s.name === status);
    if (bucket) bucket.count++;
  }
  const methods = new Map<string, number>();
  let collected = 0;
  for (const payment of active) {
    collected += payment.amount_cents;
    const method = payment.method ?? "Unknown";
    methods.set(method, (methods.get(method) ?? 0) + payment.amount_cents);
  }
  return {
    statuses,
    collected,
    methods: [...methods.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
  };
}
