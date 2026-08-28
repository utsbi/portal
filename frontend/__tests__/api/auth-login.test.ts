import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateLogin: vi.fn(),
}));

vi.mock("@/lib/auth/login", () => ({
  authenticateLogin: mocks.authenticateLogin,
}));

const { POST } = await import("@/app/api/auth/login/route");

function request(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateLogin.mockResolvedValue({ success: true });
  });

  it("forwards credentials to the server authenticator without a Server Action", async () => {
    const response = await POST(
      request({
        email: " User@Example.com ",
        password: "secret-password",
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.authenticateLogin).toHaveBeenCalledWith(
      " User@Example.com ",
      "secret-password",
    );
  });

  it("does not authenticate malformed requests", async () => {
    const response = await POST(
      request({ email: "user@example.com" }) as never,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Email and password are required",
    });
    expect(mocks.authenticateLogin).not.toHaveBeenCalled();
  });

  it("returns an authentication failure without exposing provider details", async () => {
    mocks.authenticateLogin.mockResolvedValueOnce({
      success: false,
      error: "Invalid email or password",
    });

    const response = await POST(
      request({
        email: "user@example.com",
        password: "wrong-password",
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid email or password",
    });
  });
});
