-- Questionnaire schema-version snapshots.
--
-- PROPOSAL — defined in this worktree, ordered after 20260607000000. NOT applied
-- to the live database. Review before `supabase db push`.
--
-- Problem this fixes:
--   custom_form_schemas.version bumps in place when a director edits a published
--   form, but the OLD `fields` jsonb is overwritten. custom_form_submissions
--   stores schema_version (the version the answers were captured against), yet
--   nothing preserved the field definitions for that version. The director
--   responses viewer therefore re-interpreted every past submission against the
--   CURRENT schema: choice answers could render as raw values instead of the
--   labels the client actually saw, and required-field flags could be spurious.
--
--   This migration snapshots each version of a form's fields into an immutable
--   table so old submissions can be read back against the exact schema they were
--   submitted with. The application read path resolves a submission's
--   schema_version to its snapshot and degrades to the live schema when no
--   snapshot exists (e.g. before this migration is applied).
--
-- Additive and idempotent.

-- ===========================================================================
-- 1. Immutable per-version snapshot of a form's fields.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.custom_form_schema_versions (
  form_id    bigint  NOT NULL REFERENCES public.custom_form_schemas(id) ON DELETE CASCADE,
  version    integer NOT NULL,
  fields     jsonb   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_id, version),
  CONSTRAINT custom_form_schema_versions_fields_is_array
    CHECK (jsonb_typeof(fields) = 'array')
);

ALTER TABLE public.custom_form_schema_versions ENABLE ROW LEVEL SECURITY;

-- SELECT: a snapshot is no more sensitive than the live schema row, which the
-- baseline already exposes to every authenticated user (forms are not secret).
-- Reads are app-scoped to forms the caller already sees.
DROP POLICY IF EXISTS custom_form_schema_versions_select
  ON public.custom_form_schema_versions;
CREATE POLICY custom_form_schema_versions_select
  ON public.custom_form_schema_versions
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE policy: snapshots are written only by the trigger
-- below (SECURITY DEFINER), never directly by clients.

-- ===========================================================================
-- 2. Snapshot the new version whenever a form is created or its fields change.
--    The 20260607000000 BEFORE-UPDATE trigger has already set NEW.version, so an
--    AFTER trigger observes the final version number.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.snapshot_form_schema_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.fields IS DISTINCT FROM OLD.fields
     OR NEW.version IS DISTINCT FROM OLD.version THEN
    INSERT INTO public.custom_form_schema_versions (form_id, version, fields)
    VALUES (NEW.id, NEW.version, NEW.fields)
    ON CONFLICT (form_id, version)
      DO UPDATE SET fields = EXCLUDED.fields;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_form_schema_version
  ON public.custom_form_schemas;
CREATE TRIGGER trg_snapshot_form_schema_version
  AFTER INSERT OR UPDATE ON public.custom_form_schemas
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_form_schema_version();

-- ===========================================================================
-- 3. Backfill the current version of every existing form so past submissions
--    that reference it can resolve immediately.
-- ===========================================================================
INSERT INTO public.custom_form_schema_versions (form_id, version, fields)
SELECT id, version, fields FROM public.custom_form_schemas
ON CONFLICT (form_id, version) DO NOTHING;

COMMENT ON TABLE public.custom_form_schema_versions IS
  'Immutable snapshot of custom_form_schemas.fields per version. Lets the '
  'responses viewer render each submission against the schema_version it was '
  'captured with, instead of the mutated live schema.';
