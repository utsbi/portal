import { type NextRequest, NextResponse } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const pathname = request.nextUrl.pathname;
  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (!isDocsRoute) {
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  } else {
    // Let the docs worker distinguish the portal's server-side rewrite from
    // a direct browser request without adding a query parameter (which would
    // otherwise drop search and markdown negotiation parameters).
    requestHeaders.set("x-portal-docs-proxy", "1");
  }

  const needsSession =
    pathname.startsWith("/dashboard") ||
    (isDocsRoute && pathname !== "/docs/favicon.ico") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login");
  const response = needsSession
    ? await updateSession(request, requestHeaders)
    : NextResponse.next({ request: { headers: requestHeaders } });

  // The docs app is a separately-built static application. Its hydration
  // scripts do not carry the portal's per-request nonce, so applying the
  // portal CSP to the proxied HTML leaves the page looking rendered but
  // disables theme, sidebar, search, and every other client interaction.
  if (!isDocsRoute) {
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
