import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace, push: mocks.push };
  return { useRouter: () => router };
});
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/assets/images/login.jpg", () => ({ default: "login.jpg" }));
vi.mock("@/app/auth/update-password/actions", () => ({
  markPortalAccountActivated: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

const { default: UpdatePasswordPage } = await import(
  "@/app/auth/update-password/page"
);

describe("PKCE password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    window.history.replaceState({}, "", "/auth/update-password?code=test-code");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the form after the browser client exchanges the code", async () => {
    mocks.getSession.mockImplementation(async () => {
      // Supabase removes the code as part of its automatic exchange.
      window.history.replaceState({}, "", "/auth/update-password");
      return { data: { session: { user: { id: "test-user" } } } };
    });
    render(<UpdatePasswordPage />);
    expect(
      await screen.findByLabelText("Confirm password"),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?flow=recovery");
    expect(
      JSON.parse(window.localStorage.getItem("sbi:recovery-session") ?? "{}"),
    ).toMatchObject({ userId: "test-user" });
  });

  it("explains an unsuccessful exchange instead of redirecting to login", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(<UpdatePasswordPage />);
    expect(
      await screen.findByText(/same browser where you requested it/),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });
});
