# Production email

The portal has two email paths. They must both be verified before a production
release.

## Portal transactional email (Resend)

Resend delivers account invitations and calendar notifications. Configure the
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
5. Create, update, cancel, and RSVP to a calendar event. Confirm HTML, plain
   text, timezone, and the attached `.ics` file are correct.
6. Inspect Vercel logs for `email ... failed` and Resend logs for bounces or
   complaints.

Calendar notifications run through Next.js `after()`, use stable Resend
idempotency keys, and retry bounded transient provider failures. Account
invitations are awaited because delivery is part of account creation; a failed
delivery rolls the newly created account back.

## Supabase Auth email

Password recovery still uses Supabase Auth. Configure custom SMTP in the
Supabase production project; the built-in SMTP service is for development and
is not a production delivery channel. Resend SMTP can be used so both paths
share the same authenticated domain and monitoring account.

In Supabase Auth settings:

- set the Site URL to `NEXT_PUBLIC_SITE_URL`;
- allow `/auth/update-password` and `/auth/confirm` redirect URLs;
- configure custom SMTP credentials and sender name;
- review the password-recovery template;
- set a deliberate Auth email rate limit; and
- run a real password-reset smoke test from `/login`.

Never place SMTP credentials or the Resend API key in `NEXT_PUBLIC_*`
variables, source control, screenshots, or client-side code.

## Release order

The native calendar schema is required by the frontend routes. Apply pending
Supabase migrations and run the pgTAP suite before promoting the Vercel
deployment. The frontend deploy is not a substitute for applying database
migrations.
