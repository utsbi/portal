import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safeLoginRedirect } from "@/lib/auth/redirect";
import {
  authCookieOptions,
  isCookieChunk,
  legacyAuthCookieName,
  legacyAuthCookieOptions,
} from "@/lib/supabase/cookie-options";

interface CookieValue {
  name: string;
  value: string;
}

interface PendingCookie extends CookieValue {
  options: Parameters<NextResponse["cookies"]["set"]>[2];
}

export function parseCookieHeader(header: string): CookieValue[] {
  if (!header) return [];

  return header.split(";").flatMap((pair) => {
    const separator = pair.indexOf("=");
    if (separator < 1) return [];

    const name = pair.slice(0, separator).trim();
    const encodedValue = pair.slice(separator + 1).trim();
    if (!name) return [];

    try {
      return [{ name, value: decodeURIComponent(encodedValue) }];
    } catch {
      return [{ name, value: encodedValue }];
    }
  });
}

function dedupeCookies(
  cookies: CookieValue[],
  baseName: string,
  prefer: "first" | "last",
): CookieValue[] {
  const selected = new Map<string, CookieValue>();

  for (const cookie of cookies) {
    if (!isCookieChunk(cookie.name, baseName)) {
      if (!selected.has(cookie.name)) selected.set(cookie.name, cookie);
      continue;
    }

    if (prefer === "last" || !selected.has(cookie.name)) {
      selected.set(cookie.name, cookie);
    }
  }

  return [...selected.values()];
}

export async function updateSession(request: NextRequest) {
  // NextRequest.cookies stores values in a Map and therefore discards duplicate
  // cookie names. Read the raw header for the one-time legacy migration so both
  // the old host-only and newer domain-wide copies remain available.
  const originalCookies = parseCookieHeader(
    request.headers.get("cookie") ?? "",
  );
  const pendingCookies = new Map<string, PendingCookie>();
  let supabaseResponse = NextResponse.next({
    request,
  });

  const setAll = (cookiesToSet: PendingCookie[]) => {
    cookiesToSet.forEach((cookie) => {
      request.cookies.set(cookie.name, cookie.value);
      pendingCookies.set(cookie.name, cookie);
    });
    supabaseResponse = NextResponse.next({ request });
    pendingCookies.forEach(({ name, value, options }) => {
      supabaseResponse.cookies.set(name, value, options);
    });
  };

  const createAuthClient = (
    cookieOptions: typeof authCookieOptions,
    getAll: () => CookieValue[] = () => request.cookies.getAll(),
  ) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      {
        cookieOptions,
        cookies: {
          getAll,
          setAll,
        },
      },
    );

  const supabase = createAuthClient(authCookieOptions);

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // getClaims() validates the JWT locally (faster than getUser() network call)
  let { data: claimsData } = await supabase.auth.getClaims();
  let user = claimsData?.claims;

  // One-time migration from Supabase's legacy cookie name. Try both duplicate
  // occurrences because the failed cross-domain rollout could leave a stale
  // host-only cookie beside a valid domain cookie (or vice versa).
  const hasLegacyCookies = originalCookies.some((cookie) =>
    isCookieChunk(cookie.name, legacyAuthCookieName),
  );

  if (!user && hasLegacyCookies) {
    for (const preference of ["first", "last"] as const) {
      const legacy = createAuthClient(legacyAuthCookieOptions, () =>
        dedupeCookies(originalCookies, legacyAuthCookieName, preference),
      );
      const { data: legacySessionData } = await legacy.auth.getSession();
      const legacySession = legacySessionData.session;
      if (!legacySession) continue;

      const { error: migrationError } = await supabase.auth.setSession({
        access_token: legacySession.access_token,
        refresh_token: legacySession.refresh_token,
      });
      if (migrationError) continue;

      ({ data: claimsData } = await supabase.auth.getClaims());
      user = claimsData?.claims;
      if (user) break;
    }
  }

  const finalizeResponse = (response: NextResponse): NextResponse => {
    if (!user || !hasLegacyCookies) return response;

    const legacyNames = new Set(
      originalCookies
        .filter((cookie) => isCookieChunk(cookie.name, legacyAuthCookieName))
        .map((cookie) => cookie.name),
    );
    const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();

    for (const name of legacyNames) {
      // Remove a legacy domain cookie, if configured.
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        ...(domain ? { domain } : {}),
      });

      // A host-only cookie is a distinct cookie even when its name/path match.
      // ResponseCookies cannot represent both scopes, so append that expiry
      // header directly after setting the domain-scoped expiry.
      if (domain) {
        response.headers.append(
          "set-cookie",
          `${name}=; Path=/; Max-Age=0; SameSite=Lax`,
        );
      }
    }

    return response;
  };

  const redirectWithCookies = (url: URL): NextResponse => {
    const finalizedSource = finalizeResponse(supabaseResponse);
    const redirect = NextResponse.redirect(url);
    for (const cookie of finalizedSource.headers.getSetCookie()) {
      redirect.headers.append("set-cookie", cookie);
    }
    return redirect;
  };

  // Redirect to login if not authenticated and on a protected route.
  // Preserve the destination in `next` so the user lands back where they
  // were headed (e.g. /docs) after signing in.
  if (
    !user &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/docs")) &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return redirectWithCookies(url);
  }

  // Already-authenticated users hitting /login: resolve the redirect here at
  // the edge, before the (static) layout (Navbar + Footer) ever ships. Doing
  // it at the page level instead leaves a one-frame navbar/footer flash when
  // the login RSC resolves into a redirect. Mirrors the profile guard in
  // resolve-actor so an auth session without a profile doesn't loop
  // (/login -> /dashboard -> /login).
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("uid", user.sub as string)
      .maybeSingle();

    if (profile) {
      // Honor a validated `next` target (e.g. a docs.utsbi.org URL the docs
      // auth gate bounced here) before falling back to the dashboard.
      const next = safeLoginRedirect(request.nextUrl.searchParams.get("next"));
      if (next) {
        return redirectWithCookies(new URL(next, request.url));
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return redirectWithCookies(url);
    }

    if (!profileErr) {
      // Confirmed no profile row: clear the orphan session so the
      // login form is usable instead of bouncing. Falls through to
      // /login.
      await supabase.auth.signOut();
    }
    // On a transient query error we can't confirm eligibility: fail
    // open. Don't sign the user out, don't redirect — fall through to
    // /login so a DB/RLS blip never logs out a valid session.
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return finalizeResponse(supabaseResponse);
}
