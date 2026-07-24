import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Cookie options shared by every Supabase client (browser, server, proxy).
 *
 * The versioned name is intentional. The first cross-subdomain rollout reused
 * Supabase's default cookie name, leaving existing host-only cookies alongside
 * new `.utsbi.org` cookies. Browsers then sent two values for the same name and
 * different consumers selected different (often stale) refresh tokens.
 */
export function supabaseProjectRef(supabaseUrl: string): string {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const [projectRef] = hostname.split(".");
    return projectRef || "unknown";
  } catch {
    return "unknown";
  }
}

const projectRef = supabaseProjectRef(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
);

/** Supabase's pre-migration storage key. */
export const legacyAuthCookieName = `sb-${projectRef}-auth-token`;

/** Collision-free storage key shared by the portal and docs subdomain. */
export const sharedAuthCookieName = `${legacyAuthCookieName}-shared-v1`;

const cookieDomain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();

export const authCookieOptions: CookieOptionsWithName = {
  name: sharedAuthCookieName,
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

export const legacyAuthCookieOptions: CookieOptionsWithName = {
  name: legacyAuthCookieName,
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

export function isCookieChunk(name: string, baseName: string): boolean {
  return name === baseName || name.startsWith(`${baseName}.`);
}
