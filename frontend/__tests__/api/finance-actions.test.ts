/**
 * Tests for app/dashboard/finances/actions.ts
 *
 * Covers two concerns:
 *   1. Per-project director gate — every mutation must reject when
 *      requireProjectDirector returns { ok: false }.
 *   2. Mutation payload shape — when the gate passes, the Supabase client
 *      must receive the correct fields and options for each operation.
 *
 * Strategy: mock @/lib/auth/guards so requireProjectDirector is fully
 * controlled by `state.gateOk`.  Mock @/lib/supabase/server for the
 * pre-gate lookup calls (projectIdForBudget, category/tx row fetches).
 * Capture mutation arguments via state properties and assert on them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Environment stubs ────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";

// ─── Mutable per-test state ───────────────────────────────────────────────────
const state = {
  // requireProjectDirector behaviour
  gateOk: false,
  gateError: "Not authenticated",
  gateProfileId: 42,

  // Pre-gate lookup results (driven by createClient() calls inside actions)
  budgetProjectId: null as number | null, // projectIdForBudget
  categoryRow: null as { budget_id: number } | null, // deleteCategory pre-lookup
  txRow: null as { budget_id: number } | null, // updateTransaction/deleteTransaction pre-lookup

  // Result returned by gate.supabase mutations (insert/upsert/update/delete)
  mutationResult: { error: null } as {
    error: { message: string; code?: string } | null;
  },

  // Captured mutation call arguments — reset each test via reset()
  lastInsert: null as {
    table: string;
    row: Record<string, unknown>;
  } | null,
  lastUpsert: null as {
    table: string;
    rows: Record<string, unknown>[];
    opts: unknown;
  } | null,
  lastUpdate: null as {
    table: string;
    patch: Record<string, unknown>;
    col: string;
    val: unknown;
  } | null,
  lastDelete: null as {
    table: string;
    col: string;
    val: unknown;
  } | null,
};

// ─── Gate-supabase factory ────────────────────────────────────────────────────
// Created fresh on each successful gate call so mock state is isolated.
function makeMutationSupabase() {
  return {
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        state.lastInsert = { table, row };
        return Promise.resolve(state.mutationResult);
      }),
      upsert: vi.fn((rows: Record<string, unknown>[], opts?: unknown) => {
        state.lastUpsert = { table, rows, opts };
        return Promise.resolve(state.mutationResult);
      }),
      update: vi.fn((patch: Record<string, unknown>) => ({
        eq: vi.fn((col: string, val: unknown) => {
          state.lastUpdate = { table, patch, col, val };
          return Promise.resolve(state.mutationResult);
        }),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn((col: string, val: unknown) => {
          state.lastDelete = { table, col, val };
          return Promise.resolve(state.mutationResult);
        }),
      })),
    })),
  };
}

// ─── @/lib/auth/guards mock ───────────────────────────────────────────────────
vi.mock("@/lib/auth/guards", () => ({
  requireProjectDirector: vi.fn(async () => {
    if (!state.gateOk) return { ok: false, error: state.gateError };
    return {
      ok: true,
      supabase: makeMutationSupabase(),
      userId: "uid-test",
      profileId: state.gateProfileId,
    };
  }),
}));

// ─── @/lib/supabase/server mock (pre-gate lookup calls) ──────────────────────
// These handle projectIdForBudget(), deleteCategory's category lookup, and
// updateTransaction/deleteTransaction's budget_transactions lookup.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => {
          if (table === "project_budgets") {
            return state.budgetProjectId !== null
              ? { data: { project_id: state.budgetProjectId }, error: null }
              : { data: null, error: null };
          }
          if (table === "budget_categories") {
            return { data: state.categoryRow, error: null };
          }
          if (table === "budget_transactions") {
            return { data: state.txRow, error: null };
          }
          return { data: null, error: null };
        }),
      };
      return chain;
    }),
  })),
}));

// ─── next/cache mock ──────────────────────────────────────────────────────────
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ─── Import actions AFTER mocks are registered ───────────────────────────────
const {
  createBudget,
  upsertCategories,
  deleteCategory,
  logTransaction,
  updateTransaction,
  deleteTransaction,
} = await import("@/app/dashboard/finances/actions");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function reset() {
  state.gateOk = false;
  state.gateError = "Not authenticated";
  state.gateProfileId = 42;
  state.budgetProjectId = null;
  state.categoryRow = null;
  state.txRow = null;
  state.mutationResult = { error: null };
  state.lastInsert = null;
  state.lastUpsert = null;
  state.lastUpdate = null;
  state.lastDelete = null;
}

/**
 * Put the gate into "approved" mode and populate all pre-gate lookups so the
 * gate call is actually reached in every action.
 */
function approveGate(projectId = 5) {
  state.gateOk = true;
  state.budgetProjectId = projectId;
  state.categoryRow = { budget_id: 1 };
  state.txRow = { budget_id: 1 };
}

// ─── 1. Project-director gating ───────────────────────────────────────────────
describe("finance/actions — project-director gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    // Gate is shut; pre-gate lookups succeed so the gate is actually invoked.
    state.gateOk = false;
    state.gateError = "Director role required";
    state.budgetProjectId = 7;
    state.categoryRow = { budget_id: 1 };
    state.txRow = { budget_id: 1 };
  });
  afterEach(() => vi.restoreAllMocks());

  it("createBudget — non-director is rejected and no insert is issued", async () => {
    const res = await createBudget({
      projectId: 7,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    expect(res.error).toMatch(/director role required/i);
    expect(state.lastInsert).toBeNull();
  });

  it("upsertCategories — non-director is rejected and no upsert is issued", async () => {
    const res = await upsertCategories(1, [
      { name: "Labour", expected_amount: 1000, sort_order: 0 },
    ]);
    expect(res.error).toMatch(/director role required/i);
    expect(state.lastUpsert).toBeNull();
  });

  it("deleteCategory — non-director is rejected and no delete is issued", async () => {
    const res = await deleteCategory(99);
    expect(res.error).toMatch(/director role required/i);
    expect(state.lastDelete).toBeNull();
  });

  it("logTransaction — non-director is rejected and no insert is issued", async () => {
    const res = await logTransaction({
      budget_id: 1,
      category_id: 2,
      occurred_on: "2025-03-15",
      title: "Coffee",
      amount: 5,
    });
    expect(res.error).toMatch(/director role required/i);
    expect(state.lastInsert).toBeNull();
  });

  it("updateTransaction — non-director is rejected and no update is issued", async () => {
    const res = await updateTransaction(10, { title: "New Title" });
    expect(res.error).toMatch(/director role required/i);
    expect(state.lastUpdate).toBeNull();
  });

  it("deleteTransaction — non-director is rejected and no delete is issued", async () => {
    const res = await deleteTransaction(10);
    expect(res.error).toMatch(/director role required/i);
    expect(state.lastDelete).toBeNull();
  });
});

// ─── 2. createBudget payload ──────────────────────────────────────────────────
describe("finance/actions — createBudget payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    approveGate(5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("inserts all required fields into project_budgets", async () => {
    const res = await createBudget({
      projectId: 5,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      currency: "EUR",
    });
    expect(res.error).toBeUndefined();
    expect(state.lastInsert).toMatchObject({
      table: "project_budgets",
      row: {
        project_id: 5,
        period_start: "2025-01-01",
        period_end: "2025-12-31",
        currency: "EUR",
        created_by: state.gateProfileId,
      },
    });
  });

  it("defaults currency to 'USD' when the field is omitted", async () => {
    await createBudget({
      projectId: 5,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    expect(state.lastInsert?.row.currency).toBe("USD");
  });

  it("propagates a Supabase error returned by the insert", async () => {
    state.mutationResult = { error: { message: "duplicate key" } };
    const res = await createBudget({
      projectId: 5,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    expect(res.error).toBe("duplicate key");
  });
});

// ─── 3. upsertCategories payload ──────────────────────────────────────────────
describe("finance/actions — upsertCategories payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    approveGate(5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Budget not found' when projectIdForBudget yields null", async () => {
    state.budgetProjectId = null;
    const res = await upsertCategories(99, []);
    expect(res.error).toMatch(/budget not found/i);
  });

  it("upserts rows with trimmed names, correct fields, and onConflict options", async () => {
    const drafts = [
      { name: "  Labour  ", expected_amount: 1000, sort_order: 0 },
      { id: 7, name: "Materials", expected_amount: 500, sort_order: 1 },
    ];
    const res = await upsertCategories(1, drafts);
    expect(res.error).toBeUndefined();

    const upsert = state.lastUpsert!;
    expect(upsert.table).toBe("budget_categories");
    // Name is trimmed; no id key for new drafts
    expect(upsert.rows[0]).toMatchObject({
      budget_id: 1,
      name: "Labour",
      expected_amount: 1000,
      sort_order: 0,
    });
    expect(upsert.rows[0].id).toBeUndefined();
    // Existing draft keeps its id
    expect(upsert.rows[1]).toMatchObject({ id: 7, name: "Materials" });
    // Conflict options are passed correctly
    expect(upsert.opts).toMatchObject({
      onConflict: "id",
      defaultToNull: false,
    });
  });
});

// ─── 4. deleteCategory ────────────────────────────────────────────────────────
describe("finance/actions — deleteCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    approveGate(5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Category not found' when the category lookup returns null", async () => {
    state.categoryRow = null;
    const res = await deleteCategory(99);
    expect(res.error).toMatch(/category not found/i);
  });

  it("deletes the correct category row by id", async () => {
    const res = await deleteCategory(42);
    expect(res.error).toBeUndefined();
    expect(state.lastDelete).toMatchObject({
      table: "budget_categories",
      col: "id",
      val: 42,
    });
  });

  it("returns a human-readable message on FK violation (23503)", async () => {
    state.mutationResult = {
      error: { message: "FK violation", code: "23503" },
    };
    const res = await deleteCategory(42);
    expect(res.error).toMatch(/reassign or delete/i);
  });

  it("propagates other Supabase errors unchanged", async () => {
    state.mutationResult = {
      error: { message: "permission denied", code: "42501" },
    };
    const res = await deleteCategory(42);
    expect(res.error).toBe("permission denied");
  });
});

// ─── 5. logTransaction payload ────────────────────────────────────────────────
describe("finance/actions — logTransaction payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    approveGate(5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Budget not found' when projectIdForBudget yields null", async () => {
    state.budgetProjectId = null;
    const res = await logTransaction({
      budget_id: 99,
      category_id: 1,
      occurred_on: "2025-05-01",
      title: "Test",
      amount: 50,
    });
    expect(res.error).toMatch(/budget not found/i);
  });

  it("inserts all required fields with trimmed title into budget_transactions", async () => {
    const res = await logTransaction({
      budget_id: 1,
      category_id: 3,
      occurred_on: "2025-05-01",
      title: "  Office supplies  ",
      description: "  Pens and paper  ",
      amount: 75.5,
    });
    expect(res.error).toBeUndefined();
    expect(state.lastInsert).toMatchObject({
      table: "budget_transactions",
      row: {
        budget_id: 1,
        category_id: 3,
        occurred_on: "2025-05-01",
        title: "Office supplies",
        description: "Pens and paper",
        amount: 75.5,
        created_by: state.gateProfileId,
      },
    });
  });

  it("stores null for description when the field is omitted", async () => {
    await logTransaction({
      budget_id: 1,
      category_id: 3,
      occurred_on: "2025-05-01",
      title: "Coffee",
      amount: 4,
    });
    expect(state.lastInsert?.row.description).toBeNull();
  });

  it("stores null for description when it is an empty string", async () => {
    await logTransaction({
      budget_id: 1,
      category_id: 3,
      occurred_on: "2025-05-01",
      title: "Coffee",
      description: "   ",
      amount: 4,
    });
    expect(state.lastInsert?.row.description).toBeNull();
  });
});

// ─── 6. updateTransaction payload ────────────────────────────────────────────
describe("finance/actions — updateTransaction payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    approveGate(5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Transaction not found' when the tx lookup returns null", async () => {
    state.txRow = null;
    const res = await updateTransaction(99, { title: "X" });
    expect(res.error).toMatch(/transaction not found/i);
  });

  it("sends only the supplied patch fields and targets the correct transaction id", async () => {
    const res = await updateTransaction(10, {
      title: "  New Title  ",
      amount: 200,
    });
    expect(res.error).toBeUndefined();
    const upd = state.lastUpdate!;
    expect(upd.table).toBe("budget_transactions");
    expect(upd.patch).toMatchObject({ title: "New Title", amount: 200 });
    // Unsupplied fields must not appear in the patch
    expect(upd.patch.category_id).toBeUndefined();
    expect(upd.patch.occurred_on).toBeUndefined();
    expect(upd.patch.description).toBeUndefined();
    expect(upd.col).toBe("id");
    expect(upd.val).toBe(10);
  });

  it("normalises a whitespace-only description to null in the patch", async () => {
    await updateTransaction(10, { description: "   " });
    expect(state.lastUpdate?.patch.description).toBeNull();
  });
});

// ─── 7. deleteTransaction ────────────────────────────────────────────────────
describe("finance/actions — deleteTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    approveGate(5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Transaction not found' when the tx lookup returns null", async () => {
    state.txRow = null;
    const res = await deleteTransaction(99);
    expect(res.error).toMatch(/transaction not found/i);
  });

  it("deletes the correct transaction row by id", async () => {
    const res = await deleteTransaction(77);
    expect(res.error).toBeUndefined();
    expect(state.lastDelete).toMatchObject({
      table: "budget_transactions",
      col: "id",
      val: 77,
    });
  });

  it("propagates a Supabase error returned by the delete", async () => {
    state.mutationResult = { error: { message: "row not found" } };
    const res = await deleteTransaction(77);
    expect(res.error).toBe("row not found");
  });
});
