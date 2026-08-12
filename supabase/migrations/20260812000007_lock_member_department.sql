-- A member's department is roster metadata. Members may edit their name, but
-- only directors (or trusted service-role administration) may change it.

CREATE OR REPLACE FUNCTION public.prevent_member_department_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.role = 'member'
     AND NEW.department IS DISTINCT FROM OLD.department
     AND auth.uid() IS NOT NULL
     AND NOT public.is_director(auth.uid())
  THEN
    RAISE EXCEPTION 'Members cannot change their department'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_member_department_change ON public.profiles;
CREATE TRIGGER prevent_member_department_change
  BEFORE UPDATE OF department ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_member_department_change();
