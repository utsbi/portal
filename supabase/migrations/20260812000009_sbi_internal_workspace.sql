-- SBI is the internal roster workspace. Account roles remain profiles.role;
-- project_members.role is retained only for existing authorization/ownership.
-- No client-project memberships or permission policies are broadened here.

-- Identify the existing SBI once, then persist a rename-safe marker. Do not
-- guess which workspace to use if multiple projects are named SBI.
DO $$
DECLARE
  sbi_id bigint;
  candidates integer;
BEGIN
  SELECT count(*), min(id) INTO candidates, sbi_id
  FROM public.projects WHERE config->>'workspace_type' = 'sbi';
  IF candidates = 0 THEN
    SELECT count(*), min(id) INTO candidates, sbi_id
    FROM public.projects WHERE upper(btrim(company_name)) = 'SBI';
  END IF;
  IF candidates > 1 THEN
    RAISE EXCEPTION 'Multiple SBI candidates; select one before applying this migration';
  END IF;
  IF sbi_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = sbi_id AND archived_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Restore SBI before applying this migration';
    END IF;
    UPDATE public.projects SET is_default = false WHERE is_default AND id <> sbi_id;
    UPDATE public.projects
    SET config = coalesce(config, '{}'::jsonb) || '{"workspace_type":"sbi"}'::jsonb,
        is_default = true
    WHERE id = sbi_id;
  END IF;
END;
$$;

CREATE UNIQUE INDEX projects_one_sbi_workspace
  ON public.projects ((config->>'workspace_type'))
  WHERE config->>'workspace_type' = 'sbi';

-- A clean installation with no SBI yet can provision a project with the same
-- marker. Never repurpose an arbitrary client project as the staff default.
CREATE OR REPLACE FUNCTION public.sync_sbi_profile_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE sbi_id bigint;
BEGIN
  SELECT id INTO sbi_id FROM public.projects
  WHERE config->>'workspace_type' = 'sbi';
  IF sbi_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.role = 'client' THEN
    DELETE FROM public.project_members WHERE project_id = sbi_id AND profile_id = NEW.id;
  ELSE
    INSERT INTO public.project_members (project_id, profile_id, role)
    VALUES (sbi_id, NEW.id,
      CASE WHEN NEW.role IN ('director', 'president')
        THEN 'director'::extensions.project_role ELSE 'member'::extensions.project_role END)
    ON CONFLICT (project_id, profile_id) DO UPDATE
    SET role = CASE WHEN project_members.role = 'owner' THEN project_members.role ELSE EXCLUDED.role END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_member_to_default_project ON public.profiles;
CREATE TRIGGER trg_sync_sbi_profile_membership
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_sbi_profile_membership();

CREATE OR REPLACE FUNCTION public.populate_sbi_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.config->>'workspace_type' IS DISTINCT FROM 'sbi' THEN RETURN NEW; END IF;
  DELETE FROM public.project_members pm USING public.profiles p
    WHERE pm.project_id = NEW.id AND pm.profile_id = p.id AND p.role = 'client';
  INSERT INTO public.project_members (project_id, profile_id, role)
  SELECT NEW.id, p.id,
    CASE WHEN p.role IN ('director', 'president')
      THEN 'director'::extensions.project_role ELSE 'member'::extensions.project_role END
  FROM public.profiles p WHERE p.role <> 'client'
  ON CONFLICT (project_id, profile_id) DO UPDATE
    SET role = CASE WHEN project_members.role = 'owner' THEN project_members.role ELSE EXCLUDED.role END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_populate_sbi_workspace
  AFTER INSERT OR UPDATE OF config ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.populate_sbi_workspace();

-- Backfill the marked workspace without touching any other project.
DELETE FROM public.project_members pm USING public.projects project, public.profiles profile
WHERE pm.project_id = project.id AND pm.profile_id = profile.id
  AND project.config->>'workspace_type' = 'sbi' AND profile.role = 'client';
INSERT INTO public.project_members (project_id, profile_id, role)
SELECT project.id, profile.id,
  CASE WHEN profile.role IN ('director', 'president')
    THEN 'director'::extensions.project_role ELSE 'member'::extensions.project_role END
FROM public.projects project CROSS JOIN public.profiles profile
WHERE project.config->>'workspace_type' = 'sbi' AND profile.role <> 'client'
ON CONFLICT (project_id, profile_id) DO UPDATE
  SET role = CASE WHEN project_members.role = 'owner' THEN project_members.role ELSE EXCLUDED.role END;

-- Protect the invariant even from stale application mutations. Deleting a
-- profile itself is allowed: its FK cascade sees no surviving parent profile.
CREATE OR REPLACE FUNCTION public.protect_sbi_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE profile_role text;
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') AND EXISTS (
    SELECT 1 FROM public.projects WHERE id = OLD.project_id AND config->>'workspace_type' = 'sbi'
  ) THEN
    IF TG_OP = 'DELETE' OR NEW.project_id <> OLD.project_id OR NEW.profile_id <> OLD.profile_id THEN
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.profile_id AND role <> 'client') THEN
        RAISE EXCEPTION 'SBI membership is managed automatically' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = NEW.project_id AND config->>'workspace_type' = 'sbi') THEN
    SELECT role::text INTO profile_role FROM public.profiles WHERE id = NEW.profile_id;
    IF profile_role = 'client' THEN
      RAISE EXCEPTION 'Clients cannot belong to SBI' USING ERRCODE = '42501';
    END IF;
    IF NEW.role <> 'owner' THEN
      NEW.role := CASE WHEN profile_role IN ('director', 'president')
        THEN 'director'::extensions.project_role ELSE 'member'::extensions.project_role END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_sbi_membership
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_sbi_membership();

CREATE OR REPLACE FUNCTION public.protect_sbi_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.config->>'workspace_type' = 'sbi' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'The SBI workspace cannot be deleted' USING ERRCODE = '42501';
    END IF;
    IF NEW.config->>'workspace_type' IS DISTINCT FROM 'sbi' OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'The SBI workspace cannot be archived or unmarked' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_sbi_workspace
  BEFORE UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.protect_sbi_workspace();
ALTER TABLE public.projects ADD CONSTRAINT sbi_workspace_must_be_active
  CHECK (config->>'workspace_type' IS DISTINCT FROM 'sbi' OR archived_at IS NULL);

-- Disable the old configurable default destination, including direct RPC calls.
CREATE OR REPLACE FUNCTION public.set_default_project(_project_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION 'SBI is the fixed internal workspace' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.set_default_project(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_sbi_profile_membership(), public.populate_sbi_workspace(),
  public.protect_sbi_membership(), public.protect_sbi_workspace() FROM PUBLIC, anon, authenticated;
