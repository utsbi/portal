-- Public / private questionnaire forms.
--
-- PROPOSAL — defined in this worktree, ordered after 20260609000000. NOT applied
-- to the live database. Review before `supabase db push`.
--
-- Adds capability-link sharing (optionally password-protected) and anonymous
-- external submissions, so a form can be used like a Google Form (e.g. new
-- member applications) without a portal account.
--
-- SECURITY MODEL (important):
--   * No anonymous RLS is opened on these tables. Every public read/write is
--     mediated server-side by the service role, only after the server verifies
--     the token (+ password, + Turnstile). The browser never touches the DB on
--     the public path.
--   * The token is a capability secret in the URL (stored plaintext for re-copy);
--     a leak only allows viewing/submitting that one public form, never reading
--     existing submissions (those stay owner-only via existing RLS).
--   * The password is a real credential and is bcrypt/scrypt-hashed by the app
--     before it reaches this column; plaintext is never stored.

ALTER TABLE public.custom_form_schemas
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'link', 'password')),
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS public_password_hash text;

-- One form per token; partial unique so the many internal forms (NULL token)
-- coexist without collisions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_form_schemas_public_token
  ON public.custom_form_schemas (public_token)
  WHERE public_token IS NOT NULL;

-- Anonymous external submissions: no auth user; identity captured separately.
ALTER TABLE public.custom_form_submissions
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS submitter_name text,
  ADD COLUMN IF NOT EXISTS submitter_email text;

COMMENT ON COLUMN public.custom_form_schemas.visibility IS
  'internal = project-assigned (RLS by membership); link = anyone with public_token; password = link + public_password_hash.';
COMMENT ON COLUMN public.custom_form_schemas.public_token IS
  'Capability token for the public share link /forms/<token>. NULL unless visibility <> internal. Stored plaintext (URL secret), not a credential.';
COMMENT ON COLUMN public.custom_form_schemas.public_password_hash IS
  'Salted scrypt hash of the public password (visibility = password). Never plaintext.';
COMMENT ON COLUMN public.custom_form_submissions.user_id IS
  'Auth user for internal submissions; NULL for anonymous public submissions (see submitter_name / submitter_email).';
COMMENT ON COLUMN public.custom_form_submissions.submitter_name IS
  'Name captured from an anonymous public submitter (NULL for authenticated internal submissions).';
COMMENT ON COLUMN public.custom_form_submissions.submitter_email IS
  'Email captured from an anonymous public submitter (NULL for authenticated internal submissions).';
