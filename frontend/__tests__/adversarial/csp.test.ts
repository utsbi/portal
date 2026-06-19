/**
 * ADVERSARIAL (red-team) assertions for the Content-Security-Policy emitted by
 * next.config.ts headers().
 *
 * Requirement derived FIRST:
 *   A CSP is meant to be a backstop against injected scripts. We assert the
 *   ACTUAL emitted policy and explicitly DOCUMENT that script-src contains
 *   'unsafe-inline' AND 'unsafe-eval' — which means the CSP does NOT meaningfully
 *   prevent execution of an injected inline <script>. It is defense-in-depth /
 *   reporting value only, not an XSS mitigation. These tests make that property
 *   test-visible so any future tightening (nonces/hashes) is a deliberate change.
 *
 *   We also assert the hardening that IS effective: object-src 'none',
 *   base-uri 'self', frame-ancestors 'none', and the absence of a wildcard
 *   default-src.
 */
import { beforeAll, describe, expect, it } from "vitest";

let csp = "";
let allHeaders: Array<{ key: string; value: string }> = [];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  // Import after env so the dynamic connect-src picks it up.
  const mod = await import("@/next.config");
  const config = mod.default;
  const headerGroups = await config.headers?.();
  const group = headerGroups?.[0];
  if (!group) throw new Error("next.config headers() returned no groups");
  allHeaders = group.headers as Array<{ key: string; value: string }>;
  csp =
    allHeaders.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
});

function directive(name: string): string {
  const part = csp
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name} `) || s === name);
  return part ?? "";
}

describe("ADVERSARIAL CSP — actually-emitted policy", () => {
  it("emits a Content-Security-Policy header at all", () => {
    expect(csp.length).toBeGreaterThan(0);
  });

  // ── Documented weakness: inline/eval scripts are NOT blocked ──────────────
  it("DOCUMENTED WEAKNESS: script-src allows 'unsafe-inline' — injected inline scripts run", () => {
    const scriptSrc = directive("script-src");
    expect(scriptSrc).toContain("'unsafe-inline'");
    // Therefore: an attacker who injects <script>...</script> into the DOM is
    // NOT stopped by this CSP. The policy is defense-in-depth only.
  });

  it("DOCUMENTED WEAKNESS: script-src allows 'unsafe-eval' — eval()/new Function run", () => {
    expect(directive("script-src")).toContain("'unsafe-eval'");
  });

  it("script-src does NOT use a nonce or hash (so unsafe-inline is unmitigated)", () => {
    const scriptSrc = directive("script-src");
    expect(scriptSrc).not.toMatch(/'nonce-/);
    expect(scriptSrc).not.toMatch(/'sha(256|384|512)-/);
  });

  // ── Hardening that IS effective ───────────────────────────────────────────
  it("default-src is 'self' (not a wildcard)", () => {
    expect(directive("default-src")).toBe("default-src 'self'");
  });

  it("object-src is 'none' (blocks <object>/<embed> plugin vectors)", () => {
    expect(directive("object-src")).toBe("object-src 'none'");
  });

  it("base-uri is 'self' (blocks <base> tag base-jacking)", () => {
    expect(directive("base-uri")).toBe("base-uri 'self'");
  });

  it("frame-ancestors is 'none' (clickjacking defense)", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("connect-src includes the runtime Supabase origin and wss, not a wildcard", () => {
    const connect = directive("connect-src");
    expect(connect).toContain("https://abc.supabase.co");
    expect(connect).toContain("wss://abc.supabase.co");
    expect(connect).not.toContain("connect-src *");
  });

  it("also ships HSTS, nosniff, X-Frame-Options DENY, and a Referrer-Policy", () => {
    const keys = allHeaders.map((h) => h.key);
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(
      allHeaders.find((h) => h.key === "X-Content-Type-Options")?.value,
    ).toBe("nosniff");
    expect(allHeaders.find((h) => h.key === "X-Frame-Options")?.value).toBe(
      "DENY",
    );
  });
});
