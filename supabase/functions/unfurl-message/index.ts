/**
 * Edge Function: unfurl-message
 * -----------------------------
 * Given a `message_id`, reads the message content, extracts the first
 * http(s) URL, fetches it, scrapes <title> / OpenGraph metadata, and
 * upserts a link preview into `message_unfurls` (visible to the user).
 *
 * SECURITY: SSRF-HARDENED.
 * The target URL is fully user-controlled (a user types it into a message),
 * so this function is an SSRF vector. Without guards an authenticated user
 * could make the function fetch cloud-metadata endpoints
 * (http://169.254.169.254/...), loopback (http://127.0.0.1), or internal
 * RFC1918 / Supabase services and read back the <title>/og metadata.
 *
 * Mitigations applied here:
 *   1. Scheme allowlist  -> only http:/https:.
 *   2. IP-range blocklist -> reject IP-literal hosts in
 *      loopback/private/link-local/CGNAT/ULA/metadata ranges (v4 + v6),
 *      including IPv4-mapped IPv6 and the AWS/GCP metadata IPs.
 *   3. DNS resolution     -> resolve A + AAAA via Deno.resolveDns and reject
 *      if ANY resolved address lands in a blocked range (DNS-rebind / a
 *      hostname that points at an internal IP).
 *   4. Manual redirects   -> redirect: "manual"; each hop's Location is
 *      re-validated through the SAME checks before following (cap 3 hops),
 *      so an external URL that 302s to an internal one is blocked.
 *   5. Limits             -> 5s timeout (unchanged) + response body capped
 *      at ~512KB to avoid huge-response abuse.
 *   6. Non-default ports  -> rejected (only 80/443/empty allowed). This is
 *      strict; it blocks legit links on custom ports, but most internal
 *      services live on non-default ports so it meaningfully shrinks the
 *      attack surface. Relax MAX_STRICT_PORTS if false positives appear.
 *
 * On any blocked/invalid URL we return a clean `{ skipped: "blocked url" }`
 * without leaking *why* (no internal-target oracle for the caller).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
  "access-control-max-age": "86400",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "content-type": "application/json",
};

interface Payload { message_id: number; }

// ---- SSRF guard configuration -------------------------------------------
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const FETCH_TIMEOUT_MS = 5000;
// Set to false to allow arbitrary ports (less strict).
const ENFORCE_DEFAULT_PORTS = true;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

// Explicit metadata endpoints (belt-and-suspenders; also caught by ranges).
const BLOCKED_LITERAL_HOSTS = new Set([
  "169.254.169.254",
  "fd00:ec2::254",
]);

function decodeEntities(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ---- IP classification ---------------------------------------------------

/** Parse a dotted-quad IPv4 string into 4 octets, or null if not IPv4. */
function parseIPv4(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1, 5).map((o) => parseInt(o, 10));
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

/** True if an IPv4 octet array is in a blocked (non-routable/internal) range. */
function isBlockedIPv4(o: number[]): boolean {
  const [a, b] = o;
  if (a === 0) return true;                         // 0.0.0.0/8
  if (a === 127) return true;                       // 127.0.0.0/8 loopback
  if (a === 10) return true;                        // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  if (a === 169 && b === 254) return true;          // 169.254.0.0/16 link-local + metadata
  if (a === 100 && b >= 64 && b <= 127) return true;// 100.64.0.0/10 CGNAT
  return false;
}

/**
 * Normalize an IPv6 host (strip [] if present) and classify.
 * Handles ::1 loopback, fc00::/7 ULA, fe80::/10 link-local, unspecified,
 * and IPv4-mapped (::ffff:a.b.c.d) by delegating to the IPv4 checks.
 */
function isBlockedIPv6(rawHost: string): boolean {
  let h = rawHost.toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  // Drop zone id (fe80::1%eth0).
  const pct = h.indexOf("%");
  if (pct !== -1) h = h.slice(0, pct);

  // IPv4-mapped / -compatible embedded address: ::ffff:127.0.0.1 etc.
  const mapped = h.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    const v4 = parseIPv4(mapped[1]);
    if (v4 && isBlockedIPv4(v4)) return true;
  }

  if (!h.includes(":")) return false; // not IPv6
  if (h === "::1") return true;        // loopback
  if (h === "::") return true;         // unspecified

  // Expand to first hextet group to test prefixes.
  const firstGroup = h.split(":")[0] || "0";
  const head = parseInt(firstGroup, 16);
  if (!Number.isNaN(head)) {
    // fc00::/7  -> first 7 bits = 1111110  => 0xfc00..0xfdff
    if (head >= 0xfc00 && head <= 0xfdff) return true;
    // fe80::/10 -> 0xfe80..0xfebf
    if (head >= 0xfe80 && head <= 0xfebf) return true;
  }
  return false;
}

/** True if a literal IP string (v4 or v6, possibly bracketed) is blocked. */
function isBlockedIPLiteral(host: string): boolean {
  const v4 = parseIPv4(host);
  if (v4) return isBlockedIPv4(v4);
  if (host.includes(":") || host.startsWith("[")) return isBlockedIPv6(host);
  return false;
}

/**
 * Validate a URL string against the SSRF policy.
 * Performs scheme/port/literal-IP checks synchronously, then resolves DNS
 * (A + AAAA) and rejects if any resolved address is blocked.
 * Returns the parsed URL when safe, or null when it must be blocked.
 */
async function validateUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  // 1. Scheme allowlist.
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  // Strip brackets for IPv6 host comparison.
  const hostname = u.hostname.toLowerCase();
  const bareHost = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  if (!bareHost) return null;

  // 2. Port policy.
  if (ENFORCE_DEFAULT_PORTS && !ALLOWED_PORTS.has(u.port)) return null;

  // 3. Explicit metadata host block.
  if (BLOCKED_LITERAL_HOSTS.has(bareHost)) return null;

  // 4. IP-literal host block.
  if (isBlockedIPLiteral(bareHost)) return null;

  // 5. DNS resolution block (only for non-literal hostnames).
  const isLiteral = parseIPv4(bareHost) !== null ||
    bareHost.includes(":");
  if (!isLiteral) {
    const resolved: string[] = [];
    try {
      const a = await Deno.resolveDns(bareHost, "A");
      resolved.push(...a);
    } catch { /* no A records / NXDOMAIN handled below */ }
    try {
      const aaaa = await Deno.resolveDns(bareHost, "AAAA");
      resolved.push(...aaaa);
    } catch { /* no AAAA records */ }

    // If nothing resolved, fetch would fail anyway; treat as blocked so we
    // don't leak timing and don't attempt a fetch to an unknown target.
    if (resolved.length === 0) return null;

    for (const addr of resolved) {
      if (BLOCKED_LITERAL_HOSTS.has(addr.toLowerCase())) return null;
      if (isBlockedIPLiteral(addr)) return null;
    }
  }

  return u;
}

/**
 * SSRF-safe fetch: validates the URL and every redirect hop, capping hops.
 * Returns the final Response (status 2xx-ish) or null if blocked/failed.
 */
async function safeFetch(initialRaw: string): Promise<Response | null> {
  let currentRaw = initialRaw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = await validateUrl(currentRaw);
    if (!validated) return null;

    let resp: Response;
    try {
      resp = await fetch(validated.toString(), {
        headers: { "user-agent": "Mozilla/5.0 (compatible; SBIPortal-Unfurl/1.0)" },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    // Redirect? Re-validate the Location target before following.
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      // Drain body to free the connection.
      try { await resp.body?.cancel(); } catch { /* ignore */ }
      if (!loc) return null;
      // Resolve relative redirects against current URL.
      try {
        currentRaw = new URL(loc, validated).toString();
      } catch {
        return null;
      }
      continue;
    }

    return resp;
  }

  // Too many redirects.
  return null;
}

/** Read at most MAX_BODY_BYTES of a response body as UTF-8 text. */
async function readCappedText(resp: Response): Promise<string> {
  if (!resp.body) return await resp.text();
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
  }
  // Concatenate (truncated to the cap).
  const merged = new Uint8Array(Math.min(total, MAX_BODY_BYTES));
  let offset = 0;
  for (const c of chunks) {
    if (offset >= merged.length) break;
    const slice = c.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.86.0");

    const { message_id } = (await req.json()) as Payload;
    if (!message_id) {
      return new Response(JSON.stringify({ error: "missing message_id" }), { status: 400, headers: JSON_HEADERS });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg } = await supa.from("messages").select("id, content").eq("id", message_id).single();
    if (!msg?.content) {
      return new Response(JSON.stringify({ skipped: "no content" }), { headers: JSON_HEADERS });
    }

    const urlMatch = msg.content.match(/https?:\/\/[^\s<>"']+/);
    if (!urlMatch) {
      return new Response(JSON.stringify({ skipped: "no url" }), { headers: JSON_HEADERS });
    }
    const url = urlMatch[0];

    // --- SSRF-guarded fetch: validates URL + every redirect hop. ---
    const resp = await safeFetch(url);
    if (!resp) {
      // Blocked URL, DNS failure, redirect-to-internal, or fetch error.
      // Single opaque response — do not leak the reason.
      return new Response(JSON.stringify({ skipped: "blocked url" }), { headers: JSON_HEADERS });
    }
    if (!resp.ok) {
      try { await resp.body?.cancel(); } catch { /* ignore */ }
      return new Response(JSON.stringify({ skipped: `fetch ${resp.status}` }), { headers: JSON_HEADERS });
    }

    const html = await readCappedText(resp);

    const og = (prop: string) => {
      const m1 = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
      if (m1) return m1[1];
      const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"));
      return m2?.[1] ?? null;
    };
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null;

    const title = decodeEntities(og("og:title") ?? titleTag);
    const description = decodeEntities(og("og:description"));
    const image_url = og("og:image");
    const site_name = decodeEntities(og("og:site_name"));

    if (!title && !description && !image_url) {
      return new Response(JSON.stringify({ skipped: "no metadata" }), { headers: JSON_HEADERS });
    }

    const { error } = await supa.from("message_unfurls").upsert({
      message_id, url, title, description, image_url, site_name,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, url }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: JSON_HEADERS });
  }
});
