# Google Calendar setup

This doc is for **developers** and **self-hosters** wiring up Google Calendar
for the SBI portal. Directors who just want to connect their calendar after
setup is done don't need to read this — they go to **Settings → Calendar** in
the portal.

The portal reads events from each project director's Google Calendar, filters
to events where the project's client is an invited attendee, and shows them to
the client. When the client RSVPs from the portal, the portal writes the
attendee response back to the director's Google Calendar via
`events.patch`. No other writes happen.

## What you'll set up

1. A Google Cloud project with the Calendar API enabled
2. An OAuth consent screen
3. An OAuth Client ID (web app) with redirect URIs for local + production
4. Three env vars in `frontend/.env.local`: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

Roughly 15 minutes the first time, 2 minutes per environment after that.

## 1. Create a Google Cloud project

Open the [Cloud Console](https://console.cloud.google.com/) and create a new
project (or reuse an existing one — but each *deployment* should have its own
OAuth client, even if it shares a project).

A common pattern: `sbi-portal-dev`, `sbi-portal-prod`.

## 2. Enable the Google Calendar API

In the project, go to **APIs & Services → Library**, search for **Google
Calendar API**, and click **Enable**.

If the search returns nothing, you're in the wrong project — check the project
picker at the top.

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen.**

- User type: **External** (unless your org has Workspace and all directors are
  in the same domain — then you can pick **Internal** and skip publishing.)
- App name: `SBI Portal` (or whatever you want directors to see)
- User support email + developer email: a real address you monitor
- Authorized domains: the domain you'll deploy to (e.g. `utsbi.org`)
- Scopes: add `https://www.googleapis.com/auth/calendar.events`. This grants
  read + write on event data for the calendar the director selects in the
  portal (write is needed for client RSVPs). **Do not add other scopes** —
  the portal does not need full Calendar admin or Gmail access.
- Test users: while the app is in "Testing" mode (default), only listed test
  users can sign in. Add every director's Google account here during
  development. Up to 100 test users.

You can leave the app in Testing mode until you're ready to support more than
100 directors. Verification (required for Production) takes a week or two.

## 4. Create the OAuth Client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID.**

- Application type: **Web application**
- Name: `sbi-portal-local` (one per environment)
- Authorized JavaScript origins: not required for our flow; leave empty
- Authorized redirect URIs:

| Environment | URI |
|---|---|
| Local dev | `http://localhost:3000/api/contact/auth/google/callback` |
| Production | `https://your-deployment.example.com/api/contact/auth/google/callback` |

The redirect URI must match `GOOGLE_REDIRECT_URI` **exactly** — including
trailing slash (or lack of one) and `http` vs `https`. Mismatch is the most
common cause of `redirect_uri_mismatch` errors.

Click **Create**. Copy the **Client ID** and **Client Secret** that appear.
You'll only see the secret once — save it somewhere safe immediately.

## 5. Set environment variables

In `frontend/.env.local` (and in your production secrets store):

```bash
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/contact/auth/google/callback
```

Restart the Next.js dev server (`bun dev`) — Next does not hot-reload env
changes.

## 6. Verify the flow locally

1. Sign in as a director account (create one via **Settings → Account
   Management → Create Account** if needed, role: `director`).
2. Go to **Settings → Calendar**.
3. Click **Connect Google Calendar**.
4. Sign in with a Google account that's in your test users list.
5. Grant the requested Calendar event read + write permission.
6. You should be redirected back to **Settings → Calendar** with a success
   message. The page will show the list of calendars on that Google account.
7. Pick a calendar — preferably a dedicated "Client meetings" calendar so
   internal events don't leak through.
8. Create a test event in Google Calendar with a client account as an
   attendee.
9. Sign in as the client. Open **Calendar**. The event should appear.

## 7. Rotating the client secret

If the secret leaks (or you suspect it might have), rotate immediately:

1. In the Cloud Console, **Credentials → Your OAuth Client → Reset Secret**.
2. Update `GOOGLE_CLIENT_SECRET` in every environment that uses it
   (`.env.local` for local, your prod secrets store for prod).
3. Restart the app in each environment so the new secret is picked up.
4. **Force directors to reconnect** by clearing
   `profiles.config.google.refresh_token` for all directors:
   ```sql
   update profiles
   set config = config - 'google'
   where role = 'director' and config ? 'google';
   ```
   Old refresh tokens won't be revoked automatically, but they are bound to
   the old client secret in Google's records and won't work without it.

If only ONE director's tokens were compromised, you can scope the SQL to that
director's row.

## 8. After scope changes — force directors to reconnect

OAuth refresh tokens are bound to the exact scope they were granted with. If
this repo ever changes the scope in
`frontend/app/api/contact/auth/google/route.ts` (e.g., the move from
`calendar.readonly` → `calendar.events` to support portal RSVP), every
director's stored refresh token still has the OLD scope and will hit
`insufficient authentication scopes` on any new API call requiring the new
permission.

Fix: clear `profiles.config.google.refresh_token` for all directors and have
them reconnect:

```sql
update profiles
set config = config - 'google'
where role = 'director' and config ? 'google';
```

In the portal: **Settings → Calendar → Disconnect** then reconnect. Google
will show the new consent screen with the expanded scope.

## Common errors

### `redirect_uri_mismatch`

The redirect URI sent by the app (from `GOOGLE_REDIRECT_URI`) doesn't match
any of the **Authorized redirect URIs** on the OAuth Client. Triple-check:

- Trailing slash present in one, missing in the other
- `http` vs `https`
- Port number (`:3000` is required for local even if you usually omit it)
- `localhost` vs `127.0.0.1` (Google treats these as different)

### `invalid_grant`

The refresh token has been revoked, expired, or the client secret has been
rotated since the token was issued. The director needs to reconnect:
**Settings → Calendar → Disconnect → Connect Google Calendar**.

### `Request had insufficient authentication scopes`

The director connected before the app's OAuth scope was widened (e.g., before
RSVP write support). Their refresh token is still scoped to the old
permission. See section 8 above — disconnect + reconnect in **Settings →
Calendar** to get a token with the current scope.

### "No `refresh_token` returned" (in our app)

Google returns a refresh token **only on the first time a user consents**. If
the user previously connected and is reconnecting without revoking the app,
Google omits the refresh token.

To fix on the director's side: open
[Google → Security → Third-party access](https://myaccount.google.com/permissions),
find "SBI Portal", click **Remove Access**, then reconnect from the portal.

Our OAuth call uses `prompt: "consent"` to force re-consent, which usually
prevents this — but it can still happen if the user has multiple Google
accounts and picks a different one than the original.

### "Access blocked: SBI Portal has not completed the Google verification process"

You're in Testing mode and the user signing in isn't on the test users list.
Add them to **OAuth consent screen → Test users** and try again, or finish
publishing/verification if you've outgrown the 100-user limit.

### Events show up in the portal differently than in Google Calendar

The portal filters events to those where the **project owner's email** (from
the `profiles` table) is on the attendee list. Verify:

- The client logs in with the email that's on the event's attendee list
- The director is a member of the project (`project_members` with `role =
  'director'`)
- The director has selected a calendar in **Settings → Calendar** (not just
  connected — they must pick one)

## Reference — files involved

| File | Purpose |
|---|---|
| `frontend/app/api/contact/auth/google/route.ts` | Builds the Google consent URL and redirects |
| `frontend/app/api/contact/auth/google/callback/route.ts` | Exchanges the code, stores the refresh token, redirects to Settings |
| `frontend/app/api/contact/auth/google/disconnect/route.ts` | Clears the director's stored tokens |
| `frontend/app/api/contact/calendar/client-events/list/route.ts` | Lists the director's available calendars (for the picker) |
| `frontend/app/api/contact/calendar/client-events/select/route.ts` | Saves the director's chosen calendar ID |
| `frontend/app/api/contact/calendar/client-events/route.ts` | Pulls events for a project, filtered to where the client is an attendee |
| `frontend/app/api/contact/calendar/client-events/ics/route.ts` | Builds a `.ics` file for "Download .ics" |
| `frontend/components/dashboard/calendar/` | Client-side calendar UI |
| `frontend/app/dashboard/settings/page.tsx` | Director onboarding UI |

The stored token shape (in `profiles.config.google`):

```jsonc
{
  "refresh_token": "...",
  "access_token": "...",         // refreshed lazily by the API call
  "scope": "https://www.googleapis.com/auth/calendar.events",
  "token_type": "Bearer",
  "expiry_date": 1234567890,
  "calendar_id": "primary",      // chosen via Settings → Calendar
  "connected_at": "2026-05-21T...",
  "last_synced_at": "2026-05-21T..." // updated on each successful events fetch
}
```
