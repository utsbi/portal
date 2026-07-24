import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

function directive(csp: string, name: string): string {
  return (
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `) || part === name) ?? ""
  );
}

describe("request-scoped Content Security Policy", () => {
  const productionCsp = buildContentSecurityPolicy({
    nonce: "test-nonce",
    isDevelopment: false,
    supabaseUrl: "https://abc.supabase.co",
  });

  it("uses a nonce and blocks unapproved inline and eval scripts in production", () => {
    const scriptSrc = directive(productionCsp, "script-src");

    expect(scriptSrc).toContain("'nonce-test-nonce'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-eval only for the Next.js development runtime", () => {
    const developmentCsp = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      isDevelopment: true,
    });

    expect(directive(developmentCsp, "script-src")).toContain("'unsafe-eval'");
  });

  it("keeps required service origins narrowly allowlisted", () => {
    const connect = directive(productionCsp, "connect-src");
    expect(connect).toContain("https://abc.supabase.co");
    expect(connect).toContain("wss://abc.supabase.co");
    expect(connect).toContain("https://challenges.cloudflare.com");
    expect(connect).not.toContain("connect-src *");
  });

  it("retains framing, object, base, and form hardening", () => {
    expect(directive(productionCsp, "default-src")).toBe("default-src 'self'");
    expect(directive(productionCsp, "object-src")).toBe("object-src 'none'");
    expect(directive(productionCsp, "frame-ancestors")).toBe(
      "frame-ancestors 'none'",
    );
    expect(directive(productionCsp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(productionCsp, "form-action")).toBe("form-action 'self'");
    expect(productionCsp).toContain("upgrade-insecure-requests");
  });
});
