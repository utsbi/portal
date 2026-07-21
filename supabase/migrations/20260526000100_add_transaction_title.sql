-- Transactions get a required title (short label) and an optional description
-- (longer supplementary detail). Backfill title from the existing description.
ALTER TABLE public.budget_transactions ADD COLUMN title text;
UPDATE public.budget_transactions SET title = description WHERE title IS NULL;
ALTER TABLE public.budget_transactions ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.budget_transactions ALTER COLUMN description DROP NOT NULL;
