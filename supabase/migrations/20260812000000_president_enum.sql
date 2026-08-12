-- Add the president role. Kept in its own migration because PostgreSQL does
-- not permit the new enum label to be used until this transaction commits.
ALTER TYPE extensions.profile_role ADD VALUE IF NOT EXISTS 'president';
