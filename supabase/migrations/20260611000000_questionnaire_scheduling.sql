-- Questionnaire scheduled open/close windows.
--
-- PROPOSAL — defined in this worktree, ordered after 20260610000000. NOT applied
-- to the live database. Review before `supabase db push`.
--
-- A form may declare an opens_at and/or closes_at. The application blocks
-- submissions outside that window (drafts may still be saved); enforcement lives
-- in the server submit paths, this just stores the bounds. Both NULL = always
-- open (current behavior).

ALTER TABLE public.custom_form_schemas
  ADD COLUMN IF NOT EXISTS opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS closes_at timestamptz;

COMMENT ON COLUMN public.custom_form_schemas.opens_at IS
  'When the form starts accepting submissions (NULL = open immediately).';
COMMENT ON COLUMN public.custom_form_schemas.closes_at IS
  'When the form stops accepting submissions (NULL = never closes).';
