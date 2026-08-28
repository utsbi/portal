import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { verifyOtp: mocks.verifyOtp },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect.mockImplementation((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

const { continueAuthAction } = await import("@/app/auth/continue/actions");

function form(type: string, token = "token-123") {
  const data = new FormData();
  data.set("type", type);
  data.set("token_hash", token);
  return data;
}

describe("auth continue action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies supported tokens and redirects to a fixed destination", async () => {
    await expect(
      continueAuthAction({ error: null }, form("recovery")),
    ).rejects.toThrow("REDIRECT:/auth/update-password?flow=recovery");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "token-123",
    });
  });

  it("rejects unsupported types without consuming the token", async () => {
    await expect(
      continueAuthAction({ error: null }, form("unknown")),
    ).resolves.toEqual({
      error:
        "This link is incomplete or no longer available. Request a new one.",
    });
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("returns a neutral error when Supabase rejects a used token", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({ error: new Error("otp_expired") });
    await expect(
      continueAuthAction({ error: null }, form("invite")),
    ).resolves.toEqual({
      error:
        "This link has expired or has already been used. Request a new one.",
    });
  });
});
