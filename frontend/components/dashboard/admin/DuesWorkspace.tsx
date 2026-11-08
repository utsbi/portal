"use client";

import { Download, Plus, Search, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { manageDues } from "@/app/dashboard/admin/dues/actions";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  EmptyState,
  inputClass,
  Modal,
  Panel,
  SectionLabel,
  SelectField,
  StatTile,
} from "@/components/dashboard/common/ui";
import {
  accountBalance,
  type DuesAccount,
  type DuesMember,
  type DuesPayment,
  type DuesPeriod,
  duesCsv,
  localDate,
  money,
  parseCents,
  paymentMethods,
} from "@/lib/dues";
import type { DuesCommand } from "@/lib/dues-validation";

export type DuesWorkspaceProps = {
  periods: DuesPeriod[];
  selected: DuesPeriod | null;
  members: DuesMember[];
  accounts: DuesAccount[];
  payments: DuesPayment[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function MemberPicker({
  members,
  chosen,
  onChange,
  paid = [],
  onPaidChange,
}: {
  members: DuesMember[];
  chosen: number[];
  onChange: (ids: number[]) => void;
  paid?: number[];
  onPaidChange?: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = members.filter((m) =>
    `${m.name} ${m.email ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm text-white">
        Assign members{" "}
        <span className="text-sbi-muted">({chosen.length} selected)</span>
      </legend>
      <input
        aria-label="Search members to assign"
        placeholder="Search members…"
        className={inputClass}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex gap-4 text-xs">
        <button
          type="button"
          className="text-sbi-green underline underline-offset-4"
          onClick={() =>
            onChange([...new Set([...chosen, ...visible.map((m) => m.id)])])
          }
        >
          Select shown
        </button>
        <button
          type="button"
          className="text-sbi-muted underline underline-offset-4"
          onClick={() => onChange([])}
        >
          Clear selection
        </button>
      </div>
      {onPaidChange && (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <button
            type="button"
            disabled={!chosen.length}
            className="text-sbi-green underline underline-offset-4 disabled:opacity-50"
            onClick={() => onPaidChange([...chosen])}
          >
            Mark selected paid
          </button>
          <button
            type="button"
            className="text-sbi-muted underline underline-offset-4"
            onClick={() => onPaidChange([])}
          >
            Clear paid marks
          </button>
          <span className="text-sbi-muted">{paid.length} already paid</span>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-sbi-dark-border/50 divide-y divide-sbi-dark-border/30">
        {visible.map((member) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 hover:bg-sbi-green/5"
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-sbi-green"
                checked={chosen.includes(member.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...chosen, member.id]
                      : chosen.filter((id) => id !== member.id),
                  )
                }
              />
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="max-w-full break-words text-sm text-white">
                  {member.name}
                </span>
                <span className="max-w-full break-all text-xs text-sbi-muted">
                  {member.email ?? "No email"}
                </span>
              </span>
            </label>
            {onPaidChange && (
              <label className="ml-7 flex shrink-0 cursor-pointer items-center gap-2 text-xs text-sbi-muted sm:ml-0">
                <input
                  type="checkbox"
                  aria-label={`Already paid: ${member.name}`}
                  className="size-4 accent-sbi-green"
                  disabled={!chosen.includes(member.id)}
                  checked={paid.includes(member.id)}
                  onChange={(e) =>
                    onPaidChange(
                      e.target.checked
                        ? [...paid, member.id]
                        : paid.filter((id) => id !== member.id),
                    )
                  }
                />
                Already paid
              </label>
            )}
          </div>
        ))}
        {!visible.length && (
          <p className="p-4 text-sm text-sbi-muted">No matching members.</p>
        )}
      </div>
    </fieldset>
  );
}

export function DuesWorkspace({
  periods,
  selected,
  members,
  accounts,
  payments,
}: DuesWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [dialog, setDialog] = useState<"period" | "members" | "paid" | null>(
    null,
  );
  const [chosen, setChosen] = useState<number[]>([]);
  const [paidChosen, setPaidChosen] = useState<number[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [paymentKey, setPaymentKey] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [correctionId, setCorrectionId] = useState<number | null>(null);
  const [waiverOpen, setWaiverOpen] = useState(false);
  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );
  const rows = accounts
    .map((account) => ({
      account,
      member: memberMap.get(account.profile_id),
      ...accountBalance(account, payments),
    }))
    .sort((a, b) => (a.member?.name ?? "").localeCompare(b.member?.name ?? ""));
  const overdue = !!selected && selected.due_on < localDate();
  const visible = rows.filter(
    (r) =>
      `${r.member?.name ?? ""} ${r.member?.email ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All statuses" ||
        r.status === filter ||
        (filter === "Overdue" && overdue && r.balance > 0)),
  );
  const totals = rows.reduce(
    (t, r) => ({
      expected: t.expected + (r.account.waived ? 0 : r.account.amount_cents),
      paid: t.paid + r.paid,
      balance: t.balance + r.balance,
      complete: t.complete + Number(r.status === "Paid"),
    }),
    { expected: 0, paid: 0, balance: 0, complete: 0 },
  );
  const detail = rows.find((r) => r.account.id === detailId);
  const history = payments.filter((p) => p.account_id === detailId);
  const unpaidMembers = rows
    .filter((r) => r.status === "Unpaid")
    .flatMap((r) => (r.member ? [r.member] : []));
  const unassigned = members.filter(
    (m) => !accounts.some((a) => a.profile_id === m.id),
  );
  const alert = error ? (
    <p
      role="alert"
      className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300"
    >
      {error}
    </p>
  ) : null;

  function run(command: DuesCommand, onSuccess?: (id?: number) => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await manageDues(command);
        if (result.error) {
          setError(result.error);
          return;
        }
        onSuccess?.(result.id);
        toast.success(
          command.action === "record_payment"
            ? "Payment recorded"
            : "Dues updated",
        );
        router.refresh();
      } catch {
        setError(
          "The change could not be confirmed. Retry the unchanged form without closing it, or reload to check whether it was saved.",
        );
      }
    });
  }

  function openDialog(next: "period" | "members" | "paid") {
    setPeriodKey(crypto.randomUUID());
    setChosen([]);
    setPaidChosen([]);
    setError("");
    setDialog(next);
  }

  function openDetail(id: number) {
    setDetailId(id);
    setPaymentKey(crypto.randomUUID());
    setError("");
    setCorrectionId(null);
    setWaiverOpen(false);
  }

  function savePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = parseCents(String(data.get("amount")));
    if (!amount) {
      setError("Enter a positive amount with at most two decimal places.");
      return;
    }
    run(
      {
        action: "create_period",
        request_id: periodKey,
        name: String(data.get("name")),
        amount_cents: amount,
        due_on: String(data.get("due_on")),
        profile_ids: chosen,
        paid_profile_ids: paidChosen,
      },
      (id) => {
        setDialog(null);
        setQuery("");
        setFilter("All statuses");
        router.push(`/dashboard/admin/dues?period=${id}`);
      },
    );
  }

  function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = parseCents(String(data.get("amount")));
    if (!amount || amount > detail.balance) {
      setError("Enter a positive amount no greater than the balance.");
      return;
    }
    run(
      {
        action: "record_payment",
        account_id: detail.account.id,
        request_id: paymentKey,
        amount_cents: amount,
        paid_on: String(data.get("paid_on")),
        method: String(data.get("method")),
        note: String(data.get("note")),
      },
      () => {
        setPaymentKey(crypto.randomUUID());
        form.reset();
      },
    );
  }

  function exportCsv() {
    if (!selected) return;
    const url = URL.createObjectURL(
      new Blob([duesCsv(selected, accounts, members, payments)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `dues-${selected.name.replace(/[^a-z0-9]/gi, "-")}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6" aria-busy={pending}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel>Member dues / USD</SectionLabel>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected && (
            <button
              type="button"
              className={btnPrimary}
              disabled={pending || !unpaidMembers.length}
              onClick={() => openDialog("paid")}
            >
              Mark already paid
            </button>
          )}
          {selected && (
            <button type="button" className={btnGhost} onClick={exportCsv}>
              <Download className="size-4" />
              Export period
            </button>
          )}
          <button
            type="button"
            className={btnPrimary}
            disabled={pending}
            onClick={() => openDialog("period")}
          >
            <Plus className="size-4" />
            New period
          </button>
        </div>
      </div>
      {!dialog && !detail && alert}
      {!selected ? (
        <Panel>
          <EmptyState
            icon={<Wallet className="size-7" />}
            title="Start with a dues period"
            description="Create a semester, year, or other collection period."
            action={
              <button
                type="button"
                className={btnPrimary}
                onClick={() => openDialog("period")}
              >
                Create first period
              </button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label
              htmlFor="dues-period"
              className="w-full space-y-2 text-xs text-sbi-muted sm:w-72"
            >
              Dues period
              <SelectField
                id="dues-period"
                aria-label="Dues period"
                value={selected.id}
                disabled={pending}
                onChange={(e) => {
                  setQuery("");
                  setFilter("All statuses");
                  setError("");
                  router.push(`/dashboard/admin/dues?period=${e.target.value}`);
                }}
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </SelectField>
            </label>
            <p className="text-sm text-sbi-muted">
              {money(selected.amount_cents)} per member{" "}
              <span className="mx-2 text-sbi-muted-dark">/</span> Due{" "}
              {dateLabel(selected.due_on)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Expected"
              value={money(totals.expected)}
              sublabel="Excludes waived dues"
            />
            <StatTile
              label="Collected"
              value={money(totals.paid)}
              tone="accent"
              sublabel="Recorded payments, excluding corrections"
            />
            <StatTile
              label="Outstanding"
              value={money(totals.balance)}
              tone={overdue && totals.balance > 0 ? "warning" : "default"}
              sublabel={overdue ? "Past the due date" : "Remaining to collect"}
            />
            <StatTile
              label="Members paid"
              value={`${totals.complete} / ${accounts.length}`}
              sublabel={`${rows.filter((r) => r.status === "Waived").length} waived · ${rows.filter((r) => r.status === "Partial").length} partial`}
            />
          </div>
          <Panel padded={false}>
            <div className="flex flex-col gap-3 border-b border-sbi-dark-border/50 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-2.5 size-4 text-sbi-muted"
                />
                <input
                  aria-label="Search dues records"
                  className={`${inputClass} pl-9`}
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <SelectField
                aria-label="Filter dues status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="sm:w-44"
              >
                {[
                  "All statuses",
                  "Unpaid",
                  "Partial",
                  "Paid",
                  "Waived",
                  "Overdue",
                ].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </SelectField>
              <button
                type="button"
                className={btnGhost}
                disabled={pending || !unassigned.length}
                onClick={() => openDialog("members")}
              >
                <Plus className="size-4" />
                Add members
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <caption className="sr-only">
                  Member dues for {selected.name}
                </caption>
                <thead className="bg-sbi-dark/40 text-xs uppercase tracking-wider text-sbi-muted-dark">
                  <tr>
                    {[
                      "Member",
                      "Assessed",
                      "Paid",
                      "Balance",
                      "Status",
                      "Record",
                    ].map((heading) => (
                      <th
                        scope="col"
                        key={heading}
                        className="px-5 py-4 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sbi-dark-border/30">
                  {visible.map((row) => (
                    <tr
                      key={row.account.id}
                      className="hover:bg-sbi-green/[0.025]"
                    >
                      <th scope="row" className="px-5 py-4 font-normal">
                        <span className="block text-white">
                          {row.member?.name ?? "Unknown member"}
                        </span>
                        <span className="text-xs text-sbi-muted-dark">
                          {row.member?.email ?? "No email"}
                        </span>
                      </th>
                      <td className="px-5 py-4 tabular-nums text-sbi-muted">
                        {money(row.account.amount_cents)}
                      </td>
                      <td className="px-5 py-4 tabular-nums text-sbi-muted">
                        {money(row.paid)}
                      </td>
                      <td className="px-5 py-4 tabular-nums text-white">
                        {money(row.balance)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${row.status === "Paid" ? "border-sbi-green/25 text-sbi-green" : row.balance > 0 && overdue ? "border-amber-400/25 text-amber-300" : "border-sbi-dark-border text-sbi-muted"}`}
                        >
                          {row.status}
                          {row.balance > 0 && overdue ? " · Overdue" : ""}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          className="rounded text-xs text-sbi-green underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-sbi-green"
                          aria-label={`View dues for ${row.member?.name ?? "member"}`}
                          onClick={() => openDetail(row.account.id)}
                        >
                          View record
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <EmptyState
                title={
                  accounts.length
                    ? "No matching records"
                    : "No members assigned"
                }
                description={
                  accounts.length
                    ? "Try a different search or status filter."
                    : "Add members to start tracking dues for this period."
                }
              />
            )}
            <p className="border-t border-sbi-dark-border/50 px-5 py-3 text-xs text-sbi-muted-dark">
              {visible.length} of {accounts.length} members · Payments are
              entered manually; unpaid can also mean not yet reconciled.
            </p>
          </Panel>
        </>
      )}

      <Modal
        opened={dialog !== null}
        onClose={() => {
          if (!pending) setDialog(null);
        }}
        title={
          dialog === "period"
            ? "Create dues period"
            : dialog === "paid"
              ? "Mark already paid"
              : "Add members"
        }
        size="lg"
      >
        <form
          onSubmit={
            dialog === "period"
              ? savePeriod
              : (event) => {
                  event.preventDefault();
                  if (selected)
                    run(
                      {
                        action:
                          dialog === "paid" ? "mark_paid" : "assign_members",
                        request_id: periodKey,
                        period_id: selected.id,
                        profile_ids: chosen,
                        ...(dialog === "paid"
                          ? {}
                          : { paid_profile_ids: paidChosen }),
                      },
                      () => setDialog(null),
                    );
                }
          }
          className="space-y-5"
        >
          {alert}
          <fieldset disabled={pending} className="space-y-5">
            {dialog === "period" && (
              <>
                <p className="text-sm text-sbi-muted">
                  Select members and mark anyone who has already paid in full.
                </p>
                <label className="block space-y-2 text-sm text-sbi-muted">
                  Period name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    placeholder="e.g. Fall 2026"
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-sm text-sbi-muted">
                    Amount per member (USD)
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      required
                      placeholder="30.00"
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-2 text-sm text-sbi-muted">
                    Due date
                    <input
                      name="due_on"
                      type="date"
                      required
                      className={inputClass}
                    />
                  </label>
                </div>
              </>
            )}
            {dialog === "members" && (
              <p className="text-sm text-sbi-muted">
                New members will be assigned{" "}
                {money(selected?.amount_cents ?? 0)} each. Existing records will
                not change.
              </p>
            )}
            <p className="text-sm text-sbi-muted">
              Already-paid entries use the full dues amount, with payment date
              and method left unknown. Your name and the recording time are
              saved. Partial payments should be entered through the member’s
              record.
            </p>
            <MemberPicker
              key={dialog}
              members={
                dialog === "period"
                  ? members
                  : dialog === "paid"
                    ? unpaidMembers
                    : unassigned
              }
              chosen={chosen}
              onChange={(ids) => {
                setChosen(ids);
                setPaidChosen((paid) => paid.filter((id) => ids.includes(id)));
              }}
              paid={paidChosen}
              onPaidChange={dialog === "paid" ? undefined : setPaidChosen}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={!chosen.length}
              >
                {pending
                  ? "Saving…"
                  : dialog === "period"
                    ? "Create period"
                    : dialog === "paid"
                      ? "Confirm already paid"
                      : "Assign dues"}
              </button>
            </div>
          </fieldset>
        </form>
      </Modal>

      <Modal
        opened={!!detail}
        onClose={() => {
          if (!pending) setDetailId(null);
        }}
        title={detail?.member?.name ?? "Member record"}
        uppercaseTitle={false}
        size="lg"
      >
        {detail && (
          <div className="space-y-6">
            {alert}
            <div className="flex items-center justify-between gap-4 border-b border-sbi-dark-border/50 pb-5">
              <div>
                <p className="text-sm text-sbi-muted">
                  {selected?.name} · {detail.status}
                </p>
                <p className="mt-1 text-xs text-sbi-muted-dark">
                  {detail.member?.email}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-sbi-muted">Outstanding</p>
                <p className="text-3xl font-light tabular-nums text-white">
                  {money(detail.balance)}
                </p>
              </div>
            </div>
            {detail.account.waiver_at && (
              <p className="rounded-lg border border-sbi-dark-border/50 p-3 text-sm text-sbi-muted">
                {detail.account.waived ? "Waived" : "Restored"} by{" "}
                {detail.account.waiver_by}: {detail.account.waiver_reason}
              </p>
            )}
            {detail.balance > 0 && (
              <form key={paymentKey} onSubmit={recordPayment}>
                <fieldset disabled={pending} className="space-y-4">
                  <SectionLabel>Record a payment</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-2 text-sm text-sbi-muted">
                      Amount (USD)
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        max={detail.balance / 100}
                        step="0.01"
                        defaultValue={(detail.balance / 100).toFixed(2)}
                        required
                        className={inputClass}
                      />
                    </label>
                    <label className="block space-y-2 text-sm text-sbi-muted">
                      Date received
                      <input
                        name="paid_on"
                        type="date"
                        defaultValue={localDate()}
                        max={localDate()}
                        required
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label
                    htmlFor="dues-method"
                    className="block space-y-2 text-sm text-sbi-muted"
                  >
                    Payment method
                    <SelectField
                      id="dues-method"
                      name="method"
                      defaultValue="Venmo"
                    >
                      {paymentMethods.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </SelectField>
                  </label>
                  <label className="block space-y-2 text-sm text-sbi-muted">
                    Note / reference (optional)
                    <textarea
                      name="note"
                      maxLength={1000}
                      className={inputClass}
                      rows={2}
                      placeholder="e.g. Confirmed from an earlier Venmo payment"
                    />
                  </label>
                  <button type="submit" className={btnPrimary}>
                    {pending ? "Saving…" : "Save payment record"}
                  </button>
                </fieldset>
              </form>
            )}
            <section aria-label="Payment history" className="space-y-3">
              <SectionLabel>Payment history</SectionLabel>
              {!history.length && (
                <p className="text-sm text-sbi-muted">
                  No payments recorded yet.
                </p>
              )}
              {history.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-lg border border-sbi-dark-border/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={`text-sm ${payment.voided_at ? "text-sbi-muted line-through" : "text-white"}`}
                      >
                        {money(payment.amount_cents)} ·{" "}
                        {payment.method ?? "Method unknown"}
                      </p>
                      <p className="mt-1 text-xs text-sbi-muted">
                        {payment.paid_on
                          ? `Received ${dateLabel(payment.paid_on)}`
                          : "Payment date unknown"}
                      </p>
                    </div>
                    {!payment.voided_at && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setCorrectionId(payment.id);
                          setWaiverOpen(false);
                          setError("");
                        }}
                        className="text-xs text-sbi-muted underline underline-offset-4"
                      >
                        Correct record
                      </button>
                    )}
                  </div>
                  {payment.historical && (
                    <p className="mt-2 text-xs text-sbi-green">
                      Historical payment—details unknown
                    </p>
                  )}
                  {payment.note &&
                    !(
                      payment.historical &&
                      payment.note === "Historical payment—details unknown"
                    ) && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-sbi-muted">
                        {payment.note}
                      </p>
                    )}
                  <p className="mt-2 text-xs text-sbi-muted-dark">
                    Recorded by {payment.recorded_by} ·{" "}
                    {dateLabel(payment.recorded_at.slice(0, 10))}
                  </p>
                  {payment.voided_at && (
                    <p className="mt-2 text-xs text-amber-300">
                      Voided by {payment.voided_by} ·{" "}
                      {dateLabel(payment.voided_at.slice(0, 10))}:{" "}
                      {payment.void_reason}
                    </p>
                  )}
                  {correctionId === payment.id && !payment.voided_at && (
                    <form
                      className="mt-4 space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        run(
                          {
                            action: "void_payment",
                            payment_id: payment.id,
                            reason: String(data.get("reason")),
                          },
                          () => setCorrectionId(null),
                        );
                      }}
                    >
                      <fieldset disabled={pending} className="space-y-3">
                        <p className="text-xs text-sbi-muted">
                          Void this entry, then record a replacement if needed.
                          This preserves the original record; it does not issue
                          a refund.
                        </p>
                        <label className="block space-y-2 text-sm text-sbi-muted">
                          Correction reason
                          <input
                            name="reason"
                            required
                            maxLength={1000}
                            className={inputClass}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button type="submit" className={btnDanger}>
                            Void payment record
                          </button>
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => setCorrectionId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  )}
                </div>
              ))}
            </section>
            {detail.paid === 0 && (
              <div className="border-t border-sbi-dark-border/50 pt-5">
                {!waiverOpen ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={btnGhost}
                    onClick={() => {
                      setWaiverOpen(true);
                      setCorrectionId(null);
                      setError("");
                    }}
                  >
                    {detail.account.waived ? "Restore dues" : "Waive dues"}
                  </button>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      run(
                        {
                          action: "set_waiver",
                          account_id: detail.account.id,
                          waived: !detail.account.waived,
                          reason: String(data.get("reason")),
                        },
                        () => setWaiverOpen(false),
                      );
                    }}
                  >
                    <fieldset disabled={pending} className="space-y-3">
                      <label className="block space-y-2 text-sm text-sbi-muted">
                        {detail.account.waived
                          ? "Reason for restoring dues"
                          : "Waiver reason"}
                        <input
                          name="reason"
                          required
                          maxLength={1000}
                          className={inputClass}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button type="submit" className={btnPrimary}>
                          {detail.account.waived
                            ? "Restore dues"
                            : "Confirm waiver"}
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setWaiverOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
