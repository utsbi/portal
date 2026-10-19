-- Remove Structural Engineering after the catalog-name migration.
-- Other departments, memberships, and storage roots remain unchanged.
BEGIN;

-- Pause Storage uploads/moves and drain in-flight requests before applying.
-- These locks serialize metadata writes with the guard and deletion, but
-- cannot stop an upload already in progress against the external object store.
-- The storage.objects lock affects all buckets until COMMIT.
LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.departments, public.file_spaces IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.departments AS d
    JOIN public.file_spaces AS fs ON fs.department_id = d.id
    JOIN storage.objects AS o
      ON o.bucket_id = 'Files'
      AND (o.name = fs.root_prefix OR starts_with(o.name, fs.root_prefix || '/'))
    WHERE d.slug = 'engineering-structural'
  ) THEN
    RAISE EXCEPTION 'Structural Engineering contains files. Move or delete those files through Storage before removing this department.';
  END IF;
END;
$$;

-- Cascades remove its file space, memberships, and project links.
-- Historical department text is retained. The profile membership trigger's
-- legacy structural alias no longer resolves to a department or file space.
DELETE FROM public.departments WHERE slug = 'engineering-structural';

COMMIT;
