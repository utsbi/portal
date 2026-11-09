import { isDate, localDate, paymentMethods } from "@/lib/dues";

export type DuesCommand =
  | {
      action: "create_period";
      request_id: string;
      name: string;
      amount_cents: number;
      due_on: string;
      profile_ids: number[];
      paid_profile_ids?: number[];
    }
  | {
      action: "assign_members";
      request_id: string;
      period_id: number;
      profile_ids: number[];
      paid_profile_ids?: number[];
    }
  | {
      action: "mark_paid";
      request_id: string;
      period_id: number;
      profile_ids: number[];
    }
  | {
      action: "record_payment";
      account_id: number;
      request_id: string;
      amount_cents: number;
      paid_on: string;
      method: string;
      note: string;
    }
  | {
      action: "set_waiver";
      account_id: number;
      waived: boolean;
      reason: string;
    }
  | { action: "void_payment"; payment_id: number; reason: string };

const id = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const amount = (value: unknown) => id(value) && (value as number) <= 100000000;
const requestId = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const text = (value: unknown, max: number, required = true) =>
  typeof value === "string" &&
  value.trim().length <= max &&
  (!required || value.trim().length > 0);

export function validateDuesCommand(command: DuesCommand): string | null {
  if (!command || typeof command !== "object") return "Invalid request.";
  switch (command.action) {
    case "create_period":
    case "assign_members":
    case "mark_paid":
      if (
        !Array.isArray(command.profile_ids) ||
        command.profile_ids.length === 0 ||
        command.profile_ids.length > 5000 ||
        !command.profile_ids.every(id)
      )
        return "Select at least one member (up to 5,000).";
      if (
        command.action !== "mark_paid" &&
        command.paid_profile_ids !== undefined &&
        (!Array.isArray(command.paid_profile_ids) ||
          command.paid_profile_ids.length > 5000 ||
          !command.paid_profile_ids.every(
            (value) => id(value) && command.profile_ids.includes(value),
          ))
      )
        return "Already-paid members must be included in the selected members.";
      if (!requestId(command.request_id)) return "Invalid period request.";
      if (command.action !== "create_period")
        return id(command.period_id) ? null : "Invalid period.";
      if (!text(command.name, 100))
        return "Enter a period name (up to 100 characters).";
      if (!amount(command.amount_cents)) return "Enter a valid dues amount.";
      return isDate(command.due_on) ? null : "Enter a valid due date.";
    case "record_payment":
      if (!id(command.account_id)) return "Invalid member account.";
      if (!requestId(command.request_id)) return "Invalid payment request.";
      if (!amount(command.amount_cents)) return "Enter a valid payment amount.";
      if (!isDate(command.paid_on) || command.paid_on > localDate())
        return "Enter a payment date that is not in the future.";
      if (!paymentMethods.some((method) => method === command.method))
        return "Select a payment method.";
      return text(command.note, 1000, false)
        ? null
        : "Notes must be at most 1,000 characters.";
    case "set_waiver":
      if (!id(command.account_id) || typeof command.waived !== "boolean")
        return "Invalid waiver request.";
      return text(command.reason, 1000)
        ? null
        : "Enter a reason (up to 1,000 characters).";
    case "void_payment":
      if (!id(command.payment_id)) return "Invalid payment.";
      return text(command.reason, 1000)
        ? null
        : "Enter a correction reason (up to 1,000 characters).";
    default:
      return "Unknown dues action.";
  }
}
