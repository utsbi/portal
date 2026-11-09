import { beforeEach, describe, expect, it, vi } from "vitest";
import { manageDues } from "@/app/dashboard/admin/dues/actions";
import type { DuesCommand } from "@/lib/dues-validation";

const { gate, rpc, revalidate, from, capability } = vi.hoisted(() => ({
  gate: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
  from: vi.fn(),
  capability: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireDirector: gate }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
const command: DuesCommand = {
  action: "create_period",
  request_id: "00000000-0000-4000-8000-000000000010",
  name: "Fall",
  amount_cents: 5000,
  due_on: "2026-10-01",
  profile_ids: [1, 2],
};
beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ ok: true, supabase: { rpc, from } });
  from.mockReturnValue({ select: () => ({ limit: capability }) });
  capability.mockResolvedValue({ data: [], error: null });
  rpc.mockResolvedValue({ data: 1, error: null });
});

describe("dues server actions", () => {
  it("rejects unauthorized callers before performing any mutation", async () => {
    gate.mockResolvedValue({ ok: false, error: "Director role required" });
    expect(await manageDues(command)).toEqual({
      error: "Director role required",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("validates runtime inputs before RPC", async () => {
    expect(
      (await manageDues({ ...command, amount_cents: -5 })).error,
    ).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects period creation without a valid retry key", async () => {
    expect((await manageDues({ ...command, request_id: "" })).error).toBe(
      "Invalid period request.",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses the session-bound RPC and revalidates successful changes", async () => {
    expect(await manageDues(command)).toEqual({ id: 1 });
    const { action, ...input } = command;
    expect(rpc).toHaveBeenCalledWith("manage_dues", {
      p_action: action,
      p_input: input,
    });
    expect(revalidate).toHaveBeenCalledWith("/dashboard/admin/dues");
  });
  it("refuses to silently ignore paid flags against an unmigrated database", async () => {
    capability.mockResolvedValue({
      error: { message: "column historical does not exist" },
    });
    const result = await manageDues({ ...command, paid_profile_ids: [1] });
    expect(result.error).toContain("latest dues migration");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("submits bulk reconciliation only after verifying historical support", async () => {
    const bulk = {
      action: "mark_paid" as const,
      request_id: command.request_id,
      period_id: 1,
      profile_ids: [1],
    };
    expect(await manageDues(bulk)).toEqual({ id: 1 });
    expect(from).toHaveBeenCalledWith("dues_payments");
    expect(rpc).toHaveBeenCalledWith("manage_dues", {
      p_action: "mark_paid",
      p_input: {
        request_id: command.request_id,
        period_id: 1,
        profile_ids: [1],
      },
    });
  });
  it("returns database errors without claiming success", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Outstanding balance exceeded" },
    });
    expect(await manageDues(command)).toEqual({
      error: "Outstanding balance exceeded",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });
});
