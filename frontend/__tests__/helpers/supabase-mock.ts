/**
 * Reusable Supabase mock factory.
 *
 * Usage:
 *   const { mockSupabase, mockGetUser, mockFrom } = makeSupabaseMock();
 *   vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mockSupabase }));
 */

import { vi } from "vitest";

export interface ChainMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  // Holds the terminal result returned by .single() / .maybeSingle() etc.
  _result: { data: unknown; error: unknown };
}

/** Build a fluent chainable Supabase query mock. The chain always returns itself
 *  so you can do .select().eq().single() etc. The terminal resolver (single /
 *  maybeSingle / the chain itself for list queries) returns _result. */
export function makeChain(
  initial: { data: unknown; error: unknown } = { data: null, error: null },
): ChainMock {
  const chain: ChainMock = {
    _result: initial,
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    not: vi.fn(),
  };

  // Each method returns the chain itself (fluent interface).
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  // Terminal resolvers return the stored result.
  chain.single.mockResolvedValue(chain._result);
  chain.maybeSingle.mockResolvedValue(chain._result);

  return chain;
}

export interface SupabaseMock {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  _chains: Map<string, ChainMock>;
}

/** Build a full mock Supabase client. Individual table chains can be set via
 *  the returned _chains map or by calling mockFrom(table, result). */
export function makeSupabaseMock(): {
  mockSupabase: SupabaseMock;
  setUser: (user: unknown) => void;
  setSession: (session: unknown) => void;
  setTableResult: (
    table: string,
    result: { data: unknown; error: unknown },
  ) => void;
  getChain: (table: string) => ChainMock;
} {
  const chains = new Map<string, ChainMock>();

  const mockSupabase: SupabaseMock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => {
      if (!chains.has(table)) {
        chains.set(table, makeChain());
      }
      return chains.get(table) as ChainMock;
    }),
    _chains: chains,
  };

  function setUser(user: unknown) {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user },
      error: user ? null : { message: "Not authenticated" },
    });
  }

  function setSession(session: unknown) {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
  }

  function setTableResult(
    table: string,
    result: { data: unknown; error: unknown },
  ) {
    const chain = makeChain(result);
    // Re-wire: list queries await the chain directly (it is a thenable), terminals use single/maybeSingle.
    chain.single.mockResolvedValue(result);
    chain.maybeSingle.mockResolvedValue(result);
    // Make the chain itself await-able for list queries (no .single() call)
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mocks Supabase's await-able query builder for list queries
    (chain as unknown as { then: unknown }).then = (
      onFulfilled?: (v: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled);
    chains.set(table, chain);
  }

  function getChain(table: string): ChainMock {
    if (!chains.has(table)) chains.set(table, makeChain());
    return chains.get(table) as ChainMock;
  }

  return { mockSupabase, setUser, setSession, setTableResult, getChain };
}

/** Build a minimal Request object for Next.js route handlers. */
export function makeRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  return new Request(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
