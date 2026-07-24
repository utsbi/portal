import { afterEach, describe, expect, it, vi } from "vitest";

describe("Supabase auth cookie options", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("derives stable legacy and versioned shared names from the project URL", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://exampleproject.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", ".utsbi.org");

    const options = await import("@/lib/supabase/cookie-options");

    expect(options.legacyAuthCookieName).toBe("sb-exampleproject-auth-token");
    expect(options.sharedAuthCookieName).toBe(
      "sb-exampleproject-auth-token-shared-v1",
    );
    expect(options.authCookieOptions).toEqual({
      name: "sb-exampleproject-auth-token-shared-v1",
      domain: ".utsbi.org",
    });
  });

  it("keeps the versioned name but omits the domain locally", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://exampleproject.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", "");

    const { authCookieOptions } = await import("@/lib/supabase/cookie-options");

    expect(authCookieOptions).toEqual({
      name: "sb-exampleproject-auth-token-shared-v1",
    });
  });

  it("matches only the base cookie and its chunks", async () => {
    const { isCookieChunk } = await import("@/lib/supabase/cookie-options");

    expect(isCookieChunk("session", "session")).toBe(true);
    expect(isCookieChunk("session.0", "session")).toBe(true);
    expect(isCookieChunk("session-shared-v1", "session")).toBe(false);
  });

  it("preserves duplicate cookie names when parsing a migration header", async () => {
    const { parseCookieHeader } = await import("@/lib/supabase/middleware");

    expect(
      parseCookieHeader(
        "sb-project-auth-token=old; theme=dark; sb-project-auth-token=new",
      ),
    ).toEqual([
      { name: "sb-project-auth-token", value: "old" },
      { name: "theme", value: "dark" },
      { name: "sb-project-auth-token", value: "new" },
    ]);
  });
});
