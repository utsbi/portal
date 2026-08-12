import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(
    async (_request: NextRequest, forwardedHeaders: Headers) =>
      NextResponse.next({ request: { headers: forwardedHeaders } }),
  ),
}));

import { proxy } from "@/proxy";

describe("proxy security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("attaches a unique nonce policy without production eval bypasses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");

    const first = await proxy(new NextRequest("https://portal.example.com/"));
    const second = await proxy(
      new NextRequest("https://portal.example.com/about"),
    );
    const firstCsp = first.headers.get("content-security-policy") ?? "";
    const secondCsp = second.headers.get("content-security-policy") ?? "";
    const scriptSrc =
      firstCsp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("script-src ")) ?? "";

    expect(firstCsp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(secondCsp).not.toBe(firstCsp);
  });

  it("does not apply the portal CSP to proxied docs HTML", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");

    const response = await proxy(
      new NextRequest("https://portal.example.com/docs"),
    );

    expect(response.headers.get("content-security-policy")).toBeNull();
  });
});
