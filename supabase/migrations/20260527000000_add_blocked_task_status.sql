-- Add a 'blocked' value to the lifecycle task status enum.
--
-- The enum type backing lifecycle_tasks.status was created out-of-band (no prior
-- migration in this repo defines it), so we resolve the type name dynamically
-- from the column rather than hard-coding it. Idempotent: safe to re-run.
--
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction as long as
-- the new label is not used in the same transaction; we only add it here.

DO $$
DECLARE
  enum_type regtype;
BEGIN
  SELECT atttypid::regtype
    INTO enum_type
  FROM pg_attribute
  WHERE attrelid = 'public.lifecycle_tasks'::regclass
    AND attname = 'status'
    AND NOT attisdropped;

  IF enum_type IS NULL THEN
    RAISE EXCEPTION 'Could not resolve enum type for public.lifecycle_tasks.status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = enum_type
      AND enumlabel = 'blocked'
  ) THEN
    -- Insert before 'completed' to keep the logical progression:
    -- not_started -> in_progress -> pending_approval -> blocked -> completed
    EXECUTE format(
      'ALTER TYPE %s ADD VALUE %L BEFORE %L',
      enum_type, 'blocked', 'completed'
    );
  END IF;
END
$$;
