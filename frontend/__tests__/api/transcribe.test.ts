import { beforeEach, describe, expect, it, vi } from "vitest";

// Controls the mocked Supabase client's responses per test.
const state: {
  user: { id: string } | null;
  rateAllowed: boolean | null;
  rateError: { message: string } | null;
} = {
  user: { id: "u1" },
  rateAllowed: true,
  rateError: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user } })),
    },
    rpc: vi.fn(async () => ({
      data: state.rateAllowed,
      error: state.rateError,
    })),
  })),
}));

import { POST } from "@/app/api/transcribe/route";

function audioRequest(bytes: number): Request {
  return {
    arrayBuffer: async () => new ArrayBuffer(bytes),
  } as unknown as Request;
}

beforeEach(() => {
  state.user = { id: "u1" };
  state.rateAllowed = true;
  state.rateError = null;
  process.env.ASSEMBLYAI_API_KEY = "test-key";
});

describe("POST /api/transcribe", () => {
  it("401 when unauthenticated", async () => {
    state.user = null;
    // biome-ignore lint/suspicious/noExplicitAny: minimal NextRequest stand-in
    const res = await POST(audioRequest(1024) as any);
    expect(res.status).toBe(401);
  });

  it("501 when AssemblyAI key is not configured", async () => {
    process.env.ASSEMBLYAI_API_KEY = "";
    // biome-ignore lint/suspicious/noExplicitAny: minimal NextRequest stand-in
    const res = await POST(audioRequest(1024) as any);
    expect(res.status).toBe(501);
  });

  it("400 on empty audio", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal NextRequest stand-in
    const res = await POST(audioRequest(0) as any);
    expect(res.status).toBe(400);
  });

  it("413 on oversized audio", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal NextRequest stand-in
    const res = await POST(audioRequest(26 * 1024 * 1024) as any);
    expect(res.status).toBe(413);
  });

  it("429 when the per-user rate limit is exceeded", async () => {
    state.rateAllowed = false;
    // biome-ignore lint/suspicious/noExplicitAny: minimal NextRequest stand-in
    const res = await POST(audioRequest(1024) as any);
    expect(res.status).toBe(429);
  });

  it("fails open (does NOT 429) when the limiter errors", async () => {
    // A transient limiter error must not 429 — it should reach the AssemblyAI
    // upload path. Stub fetch so the test stays hermetic (no real network).
    state.rateAllowed = null;
    state.rateError = { message: "db down" };
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);
    // biome-ignore lint/suspicious/noExplicitAny: minimal NextRequest stand-in
    const res = await POST(audioRequest(1024) as any);
    expect(res.status).not.toBe(429);
    expect(fetchMock).toHaveBeenCalled(); // proves it reached the AssemblyAI path
    vi.unstubAllGlobals();
  });
});
