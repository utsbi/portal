import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookie options shared by every Supabase client (browser, server, proxy).
 *
 * In production `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` is set to ".utsbi.org" so the
 * session cookie is also sent to subdomains — that is what lets
 * docs.utsbi.org validate the portal session and gate the docs behind login.
 * Locally and on preview deployments the variable is unset and cookies stay
 * host-only.
 */
export const authCookieOptions: CookieOptions | undefined = process.env
  .NEXT_PUBLIC_AUTH_COOKIE_DOMAIN
  ? { domain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN }
  : undefined;
