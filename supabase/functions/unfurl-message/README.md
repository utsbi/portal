# unfurl-message (SSRF-guarded)

Supabase Edge Function (Deno, `verify_jwt: true`).

## What it does

Takes a `{ message_id }`, reads the message's content, extracts the **first**
`http(s)://` URL, fetches it, scrapes `<title>` / OpenGraph metadata, and
upserts a link preview row into `message_unfurls` (visible to the user).

## Why it's security-sensitive

The fetched URL is **fully user-controlled** (a user types it into a message),
so the function is a classic **SSRF** vector. The previous version used
`fetch(url, { redirect: "follow" })` with no target validation, letting an
authenticated user make the server fetch:

- cloud metadata: `http://169.254.169.254/...`, `fd00:ec2::254`
- loopback: `http://127.0.0.1`, `[::1]`
- private nets: `10/8`, `172.16/12`, `192.168/16`, CGNAT `100.64/10`
- link-local `169.254/16`, ULA `fc00::/7`, etc.
- internal Supabase / cluster endpoints

...and read back the response's `<title>`/og metadata as a preview.

## Guards (see header comment in `index.ts` for detail)

1. **Scheme allowlist** — only `http:` / `https:`.
2. **IP-range blocklist** — IPv4 `0/8 127/8 10/8 172.16/12 192.168/16
   169.254/16 100.64/10`; IPv6 `::1 :: fc00::/7 fe80::/10` and IPv4-mapped.
3. **DNS resolution** — `Deno.resolveDns` A + AAAA; reject if **any**
   resolved address is in a blocked range (DNS-rebind / internal-pointing host).
   No records resolved ⇒ blocked.
4. **Manual redirects** — `redirect: "manual"`, each `Location` re-validated
   through the same checks before following, capped at 3 hops.
5. **Limits** — 5s timeout (unchanged) + response body capped at ~512 KB.
6. **Default ports only** (80/443/empty) — strict; toggle via
   `ENFORCE_DEFAULT_PORTS` in `index.ts` if legit custom-port links appear.

On any blocked/invalid URL the function returns an opaque
`{ skipped: "blocked url" }` (no reason leaked → no internal-target oracle).

## Authorization (IDOR protection)

The function runs with `verify_jwt: true`, so each request carries the caller's
JWT in the `Authorization` header.

1. **Require auth** — a missing `Authorization` header returns `401`.
2. **User-scoped read** — we build a **per-request user-scoped** client
   (`createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: {
   Authorization } } })`) and read the target message **through it**, so
   Postgres RLS decides visibility.
3. **RLS gate** — the `messages` SELECT policy *"Users can view messages in
   their conversations"* only returns rows whose conversation has the caller as
   `client_profile_id` or `director_profile_id`
   (`conv.client_profile_id = user_profile_id(auth.uid()) OR
   conv.director_profile_id = user_profile_id(auth.uid())`). RLS is enabled on
   `messages`, `conversations`, and `message_unfurls`. If the caller can't see
   the message, the select returns nothing → `{ skipped: "not found" }` and the
   function does **nothing else** (no fetch, no upsert). We use `maybeSingle()`
   so an RLS-hidden row is indistinguishable from a missing one (no IDOR
   oracle).
4. **Service-role scope** — the service-role client is used **only** for the
   outbound unfurl fetch and the final `message_unfurls` upsert, strictly
   **after** the user-scoped visibility check passes.

This closes the previous IDOR where any authenticated caller could pass an
arbitrary `message_id` to learn its first URL and trigger/overwrite its unfurl
across conversations.

## Known residual: DNS-rebinding (TOCTOU)

`validateUrl` resolves DNS and rejects internal addresses, and `safeFetch`
re-validates on **every redirect hop** — but the `fetch()` call re-resolves the
hostname independently of our check. A hostname that returns an external IP at
**check** time and an internal IP at **connect** time (DNS rebinding) can
therefore still slip an internal target past the guard. The per-hop re-validation
narrows the window but does **not** fully close it.

**Full closure requires** pinning the TCP connection to the already-validated IP
while preserving the `Host` header and TLS SNI — i.e. a custom
`Deno.connect`/`Deno.connectTls` HTTP client — or routing egress through a proxy
that enforces an IP allowlist at TCP connect time. We deliberately did **not**
hand-roll an IP-pinned HTTP/TLS client in the edge runtime: doing so means
re-implementing HTTP/1.1 framing, chunked/gzip decoding, redirects, and TLS by
hand, which is fragile and a security risk in its own right. The residual is
documented here rather than closed with brittle code; an egress proxy is the
recommended path if full rebind protection is required.

## Deploy

Not auto-deployed. A human deploys via the Supabase MCP
`deploy_edge_function` (project `zxqwjnxrkzvygwdltuwi`, slug `unfurl-message`,
`verify_jwt: true`).
