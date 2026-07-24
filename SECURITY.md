# Security Policy

## Reporting a vulnerability

Please report security issues privately to **<admin@utsbi.org>** rather than
opening a public issue. Include steps to reproduce, affected components, and
any relevant logs. We aim to acknowledge reports within **3 business days** and
will keep you updated as we investigate and ship a fix.

## Scope

This portal handles sensitive data and surfaces worth flagging in a report:

- **Authentication & sessions** — Supabase Auth (login, password reset, JWT/cookies).
- **Stored credentials** — Google OAuth tokens for dashboard calendar/contacts.
- **Database access** — Supabase row-level security (RLS) policies.
- **Public surface** — marketing/contact pages and unauthenticated API routes.

Please do not run automated scanners against production, and avoid accessing or
modifying data that isn't yours while testing.
