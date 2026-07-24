import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

describe("Supabase middleware cookie migration", () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClientMock.mockReset();
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://exampleproject.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", ".utsbi.org");
  });

  it("migrates the valid duplicate legacy cookie and preserves it on redirect", async () => {
    let sharedSessionIsValid = false;

    createServerClientMock.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookieOptions: { name: string };
          cookies: {
            getAll: () => Array<{ name: string; value: string }>;
            setAll: (
              cookies: Array<{
                name: string;
                value: string;
                options: Record<string, unknown>;
              }>,
            ) => void;
          };
        },
      ) => {
        const cookieName = options.cookieOptions.name;
        const isShared = cookieName.endsWith("-shared-v1");

        return {
          auth: {
            getClaims: vi.fn(async () => ({
              data: sharedSessionIsValid
                ? { claims: { sub: "user-123" } }
                : { claims: null },
            })),
            getSession: vi.fn(async () => {
              const selected = options.cookies
                .getAll()
                .find((cookie) => cookie.name === cookieName);
              return {
                data:
                  selected?.value === "fresh"
                    ? {
                        session: {
                          access_token: "access",
                          refresh_token: "refresh",
                        },
                      }
                    : { session: null },
              };
            }),
            setSession: vi.fn(async () => {
              sharedSessionIsValid = true;
              options.cookies.setAll([
                {
                  name: cookieName,
                  value: "migrated",
                  options: {
                    domain: ".utsbi.org",
                    path: "/",
                    sameSite: "lax",
                  },
                },
              ]);
              return { error: null };
            }),
            signOut: vi.fn(),
          },
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: isShared ? { id: 1 } : null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      },
    );

    const { updateSession } = await import("@/lib/supabase/middleware");
    const legacyName = "sb-exampleproject-auth-token";
    const request = new NextRequest(
      "https://dev.utsbi.org/login?next=%2Fdocs",
      {
        headers: {
          cookie: `${legacyName}=stale; ${legacyName}=fresh`,
        },
      },
    );

    const response = await updateSession(request);
    const setCookies = response.headers.getSetCookie();

    expect(response.headers.get("location")).toBe("https://dev.utsbi.org/docs");
    expect(setCookies).toContainEqual(
      expect.stringContaining(`${legacyName}-shared-v1=migrated`),
    );
    expect(
      setCookies.some(
        (cookie) =>
          cookie.startsWith(`${legacyName}=;`) &&
          cookie.includes("Domain=.utsbi.org"),
      ),
    ).toBe(true);
    expect(
      setCookies.some(
        (cookie) =>
          cookie.startsWith(`${legacyName}=;`) && !cookie.includes("Domain="),
      ),
    ).toBe(true);
  });
});
