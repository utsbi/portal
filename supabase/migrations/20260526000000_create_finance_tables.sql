-- =====================================================================
-- Finances dashboard schema
-- Spec: docs/superpowers/specs/2026-05-26-finances-redesign-design.md
-- =====================================================================

-- 1. project_budgets ---------------------------------------------------
CREATE TABLE public.project_budgets (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint REFERENCES public.profiles(id),
  CONSTRAINT project_budgets_period_check CHECK (period_end >= period_start),
  CONSTRAINT project_budgets_project_unique UNIQUE (project_id)
);

-- 2. budget_categories -------------------------------------------------
CREATE TABLE public.budget_categories (
  id              bigserial PRIMARY KEY,
  budget_id       bigint NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  name            text NOT NULL,
  expected_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (expected_amount >= 0),
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_categories_budget_name_unique UNIQUE (budget_id, name)
);

-- 3. budget_transactions -----------------------------------------------
CREATE TABLE public.budget_transactions (
  id              bigserial PRIMARY KEY,
  budget_id       bigint NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  category_id     bigint NOT NULL REFERENCES public.budget_categories(id) ON DELETE RESTRICT,
  occurred_on     date NOT NULL,
  description     text NOT NULL,
  amount          numeric(14,2) NOT NULL CHECK (amount >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint REFERENCES public.profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_tx_budget_date ON public.budget_transactions (budget_id, occurred_on);
CREATE INDEX idx_budget_tx_category    ON public.budget_transactions (category_id);

-- 4. updated_at triggers (mirror project pattern) ----------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_budgets_updated_at
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_budget_categories_updated_at
  BEFORE UPDATE ON public.budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_budget_transactions_updated_at
  BEFORE UPDATE ON public.budget_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS ---------------------------------------------------------------
ALTER TABLE public.project_budgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_transactions  ENABLE ROW LEVEL SECURITY;

-- Helper: is auth.uid() a member of the given project?
CREATE OR REPLACE FUNCTION public.is_project_member(target_project_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE pm.project_id = target_project_id AND p.uid = auth.uid()
  );
$$;

-- Helper: is auth.uid() a director on the given project?
CREATE OR REPLACE FUNCTION public.is_project_director(target_project_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE pm.project_id = target_project_id
      AND pm.role = 'director'
      AND p.uid = auth.uid()
  );
$$;

-- project_budgets policies
CREATE POLICY budget_read ON public.project_budgets
  FOR SELECT USING (public.is_project_member(project_id));
CREATE POLICY budget_insert ON public.project_budgets
  FOR INSERT WITH CHECK (public.is_project_director(project_id));
CREATE POLICY budget_update ON public.project_budgets
  FOR UPDATE USING (public.is_project_director(project_id))
                WITH CHECK (public.is_project_director(project_id));
CREATE POLICY budget_delete ON public.project_budgets
  FOR DELETE USING (public.is_project_director(project_id));

-- budget_categories policies (join through project_budgets)
CREATE POLICY cat_read ON public.budget_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_budgets b
            WHERE b.id = budget_id AND public.is_project_member(b.project_id))
  );
CREATE POLICY cat_write ON public.budget_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.project_budgets b
            WHERE b.id = budget_id AND public.is_project_director(b.project_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_budgets b
            WHERE b.id = budget_id AND public.is_project_director(b.project_id))
  );

-- budget_transactions policies (same join pattern)
CREATE POLICY tx_read ON public.budget_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_budgets b
            WHERE b.id = budget_id AND public.is_project_member(b.project_id))
  );
CREATE POLICY tx_write ON public.budget_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.project_budgets b
            WHERE b.id = budget_id AND public.is_project_director(b.project_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_budgets b
            WHERE b.id = budget_id AND public.is_project_director(b.project_id))
  );
