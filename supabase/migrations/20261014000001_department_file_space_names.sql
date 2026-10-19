-- Correct the department catalog after department_file_spaces has been applied.
-- Keep IDs and slugs stable: memberships and storage roots must not change.
BEGIN;

-- Run during a Storage maintenance window: pause uploads/moves and drain
-- in-flight requests before applying this migration. The lock serializes
-- Storage metadata writes with the guard and deletion below; it cannot stop
-- an upload already in progress against the external object store.
-- These locks are held until COMMIT and affect all buckets.
LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.departments, public.file_spaces IN SHARE ROW EXCLUSIVE MODE;

-- Do not orphan stored objects when removing a department and its file space.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.departments d
    JOIN public.file_spaces fs ON fs.department_id = d.id
    JOIN storage.objects o
      ON o.bucket_id = 'Files'
      AND (o.name = fs.root_prefix OR starts_with(o.name, fs.root_prefix || '/'))
    WHERE d.slug IN ('marketing', 'public-relations')
  ) THEN
    RAISE EXCEPTION 'Marketing or PR contains files. Move or delete those files through Storage before removing these departments.';
  END IF;
END;
$$;

UPDATE public.departments
SET name = CASE slug
  WHEN 'engineering-general' THEN 'Engineering'
  WHEN 'internal-technologies' THEN 'Tech'
  WHEN 'engineering-environmental' THEN 'Sustainability'
END
WHERE slug IN ('engineering-general', 'internal-technologies', 'engineering-environmental');

UPDATE public.file_spaces fs
SET name = d.name
FROM public.departments d
WHERE fs.department_id = d.id
  AND d.slug IN ('engineering-general', 'internal-technologies', 'engineering-environmental');

-- Cascades remove the obsolete spaces, memberships, and project links.
-- Historical profile/report/request department text is intentionally retained.
DELETE FROM public.departments WHERE slug IN ('marketing', 'public-relations');

-- Accept the renamed department in profile-derived memberships as well.
CREATE OR REPLACE FUNCTION public.sync_profile_file_space_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  target_space_id bigint;
BEGIN
  DELETE FROM public.file_space_members AS fsm
  WHERE fsm.profile_id = NEW.id
    AND fsm.membership_source = 'profile';

  IF NEW.role <> 'member' OR NEW.department IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT fs.id INTO target_space_id
  FROM public.file_spaces AS fs
  JOIN public.departments AS d ON d.id = fs.department_id
  WHERE fs.kind = 'department'
    AND d.slug = CASE lower(btrim(NEW.department))
      WHEN 'architecture' THEN 'architecture'
      WHEN 'engineering' THEN 'engineering-general'
      WHEN 'engineering — general' THEN 'engineering-general'
      WHEN 'engineering — civil' THEN 'engineering-civil'
      WHEN 'engineering — environmental' THEN 'engineering-environmental'
      WHEN 'engineering - environmental' THEN 'engineering-environmental'
      WHEN 'sustainability' THEN 'engineering-environmental'
      WHEN 'engineering — structural' THEN 'engineering-structural'
      WHEN 'engineering — electrical' THEN 'engineering-electrical'
      WHEN 'finance' THEN 'finance'
      WHEN 'business' THEN 'business'
      WHEN 'public relations' THEN 'public-relations'
      WHEN 'pr' THEN 'public-relations'
      WHEN 'marketing' THEN 'marketing'
      WHEN 'internal technologies' THEN 'internal-technologies'
      WHEN 'tech' THEN 'internal-technologies'
      WHEN 'legal' THEN 'legal'
      WHEN 'r&d' THEN 'rd'
      WHEN 'research' THEN 'rd'
      ELSE NULL
    END;

  IF target_space_id IS NOT NULL THEN
    INSERT INTO public.file_space_members
      (file_space_id, profile_id, membership_source)
    VALUES (target_space_id, NEW.id, 'profile')
    ON CONFLICT (file_space_id, profile_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


REVOKE EXECUTE ON FUNCTION public.sync_profile_file_space_membership() FROM PUBLIC, anon, authenticated;

-- The earlier migration did not recognize these aliases. Replacing the
-- trigger does not revisit existing profiles, so backfill them explicitly
-- without changing profile text or overwriting explicit memberships.
INSERT INTO public.file_space_members
  (file_space_id, profile_id, membership_source)
SELECT fs.id, p.id, 'profile'
FROM public.profiles AS p
JOIN public.departments AS d ON d.slug = 'engineering-environmental'
JOIN public.file_spaces AS fs
  ON fs.department_id = d.id AND fs.kind = 'department'
WHERE p.role = 'member'
  AND lower(btrim(p.department)) IN ('sustainability', 'engineering - environmental')
ON CONFLICT (file_space_id, profile_id) DO NOTHING;

COMMIT;
