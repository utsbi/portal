-- Discord snowflakes are 15–22 digit identifiers. Keeping them as text
-- prevents clients (especially JavaScript) from rounding them past 2^53.
ALTER TABLE public.profiles
  ALTER COLUMN discord_id TYPE text
  USING discord_id::text;

