/**
 * Validates a post-login `next` redirect target.
 *
 * Allows same-origin paths ("/docs", "/dashboard") and absolute HTTPS URLs on
 * utsbi.org and its subdomains (e.g. the docs site at docs.utsbi.org, which
 * sends users here to log in). Anything else — protocol-relative URLs,
 * non-HTTPS schemes, external hosts — returns null so callers fall back to a
 * safe default instead of becoming an open redirect.
 */
export function safeLoginRedirect(
  target: string | null | undefined,
): string | null {
  if (!target) return null;
  if (target.startsWith("/") && !target.startsWith("//")) return target;
  try {
    const url = new URL(target);
    if (
      url.protocol === "https:" &&
      (url.hostname === "utsbi.org" || url.hostname.endsWith(".utsbi.org"))
    ) {
      return url.toString();
    }
  } catch {
    // Not a parseable URL — reject.
  }
  return null;
}
