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

## Deploy

Not auto-deployed. A human deploys via the Supabase MCP
`deploy_edge_function` (project `zxqwjnxrkzvygwdltuwi`, slug `unfurl-message`,
`verify_jwt: true`).
