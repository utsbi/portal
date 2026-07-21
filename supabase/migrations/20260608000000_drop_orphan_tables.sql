-- Drop abandoned / mis-placed tables that are not part of the application schema.
--
-- 1. extensions.* app tables: the `extensions` schema is reserved for Postgres
--    extensions, not application data. These six tables are all empty (0 rows),
--    unreferenced by any application code (the app uses the `public` schema
--    exclusively), and are leftovers from early prototyping. The only FK among
--    them is extensions.tasks -> extensions.projects, so tasks is dropped first.
--
-- 2. "Reports" schema: a stray capital-R schema whose single `requests` table
--    holds 3 rows of early test data (all tagged UID ed13b878-..., the old
--    hardcoded test user that was removed from the backend in PR #48). The real
--    Reports/Requests feature is backed by public.tickets + public.messages.
--
--    ⚠️ CRITICAL: "Reports" was registered as a PostgREST-exposed schema
--    (authenticator role's pgrst.db_schemas = public,graphql_public,Reports).
--    Dropping an exposed schema while it is still exposed breaks PostgREST's
--    schema-cache introspection (error: schema "Reports" does not exist ->
--    PGRST002), which takes the ENTIRE data API (and therefore login) offline.
--    So we de-expose it and reload PostgREST config BEFORE dropping it.
--
-- Idempotent: every drop uses IF EXISTS.

-- De-expose "Reports" from PostgREST and let it reload config before the drop.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,graphql_public';
NOTIFY pgrst, 'reload config';

DROP TABLE IF EXISTS extensions.documents;
DROP TABLE IF EXISTS extensions.client_chat_sessions;
DROP TABLE IF EXISTS extensions.chat_sessions;
DROP TABLE IF EXISTS extensions.tasks;       -- references extensions.projects
DROP TABLE IF EXISTS extensions.projects;
DROP TABLE IF EXISTS extensions.custom_form_schemas;

-- CASCADE: the schema also carries a stray set_updated_at() function and a
-- "status enum" type from the same prototype; drop them with the schema.
DROP SCHEMA IF EXISTS "Reports" CASCADE;

-- Rebuild the schema cache now that the dropped objects are gone.
NOTIFY pgrst, 'reload schema';
