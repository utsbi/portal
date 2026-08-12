# Production email

The portal has two email paths. They must both be verified before a production
release.

## Portal transactional email (Resend)

Resend delivers account invitations plus message, request, and calendar
notifications. Configure the
following variables in the Vercel **Production** environment:

```env
NEXT_PUBLIC_SITE_URL=https://utsbi.org
RESEND_API_KEY=re_...
EMAIL_FROM=SBI Portal <notifications@utsbi.org>
EMAIL_TIME_ZONE=America/Chicago
```

`NEXT_PUBLIC_SITE_URL` must be the canonical HTTPS origin registered with
Supabase Auth. Do not rely on a preview deployment URL for account links.

Before release:

1. Confirm `utsbi.org` is `verified` in the Resend Domains dashboard.
2. Confirm the Resend SPF and DKIM records resolve and DMARC reporting is live.
3. Send invitations to controlled Gmail and Outlook addresses.
4. Verify the create-password link signs the recipient in, accepts a new
   password, and reaches the portal.
5. Send a message to an account with **New messages** enabled and disabled.
   Confirm only the enabled account receives one email with the correct link.
6. Update a request status for an account with **Request updates** enabled and
   disabled. Confirm only the enabled account receives the update.
7. Create, update, cancel, and RSVP to a calendar event. Confirm HTML, plain
   text, timezone, and the attached `.ics` file are correct. Calendar emails
   honor the **Calendar events** preference.
8. Inspect Vercel logs for `email ... failed` and Resend logs for bounces or
   complaints.

Calendar notifications run through Next.js `after()`, use stable Resend
idempotency keys, and retry bounded transient provider failures. Account
invitations are awaited because delivery is part of account creation; a failed
delivery rolls the newly created account back.

## Supabase Auth email

Password recovery and security notifications use Supabase Auth. The portal's
forgot-password page delegates token issuance to Supabase and redirects users
to `/auth/update-password`; it deliberately returns a neutral success message
so an attacker cannot use the form to discover which addresses have accounts.

Custom local templates live in `supabase/templates/auth/` and are configured in
`supabase/config.toml`. For the hosted project, they are **not deployed by a
migration or Vercel**. Copy each template into Supabase Dashboard →
Authentication → Email Templates (or apply the same fields through the
Management API) before release.

Configure custom SMTP in the Supabase production project; the built-in SMTP
service is for development and is not a production delivery channel. Resend
SMTP can be used so both paths share the same authenticated domain and
monitoring account.

In Supabase Auth settings:

- set the Site URL to `NEXT_PUBLIC_SITE_URL`;
- allow `/auth/update-password` and `/auth/confirm` redirect URLs;
- configure custom SMTP credentials and sender name;
- install the branded confirmation, invite, recovery, magic-link, email-change,
  and password-changed templates from `supabase/templates/auth/`;
- set a deliberate Auth email rate limit; and
- enable the password-changed security notification; and
- run a real password-reset smoke test from `/forgot-password`, including an
  expired-link scenario and Gmail/Outlook delivery checks.

Never place SMTP credentials or the Resend API key in `NEXT_PUBLIC_*`
variables, source control, screenshots, or client-side code.

## Release order

The native calendar schema is required by the frontend routes. Apply pending
Supabase migrations and run the pgTAP suite before promoting the Vercel
deployment. The frontend deploy is not a substitute for applying database
migrations.
