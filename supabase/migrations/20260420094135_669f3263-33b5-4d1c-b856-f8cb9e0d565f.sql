-- ============================================================
-- Phase 1: Revenue & Finance Hub
-- - Adds deal_value_cents + closed_at + closed_by_user_id to leads
-- - Adds commission_rules (per-org & per-rep)
-- - Adds commission_earnings (auto-generated when lead becomes 'won')
-- - Adds expenses (lightweight cost tracking for P&L)
-- - Adds trigger that fires on lead status -> 'won' to create earnings
-- ============================================================

-- 1. Lead deal value tracking
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deal_value_cents BIGINT,
  ADD COLUMN IF NOT EXISTS deal_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID;

-- 2. Commission rules — per-org default + optional per-user override
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- when user_id IS NULL, this is the org-wide default rule
  user_id UUID,
  rule_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' or 'flat'
  percent NUMERIC(5,4) NOT NULL DEFAULT 0.10, -- 10% default
  flat_cents BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_org ON public.commission_rules(organization_id);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view commission rules"
  ON public.commission_rules FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Owners manage commission rules"
  ON public.commission_rules FOR ALL
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Commission earnings — one row per closed deal per rep
CREATE TABLE IF NOT EXISTS public.commission_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- the rep who earned it
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_value_cents BIGINT NOT NULL DEFAULT 0,
  commission_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  rule_snapshot JSONB, -- capture rule that was applied (audit trail)
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'void'
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_org_user ON public.commission_earnings(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON public.commission_earnings(status);
CREATE INDEX IF NOT EXISTS idx_earnings_lead ON public.commission_earnings(lead_id);

ALTER TABLE public.commission_earnings ENABLE ROW LEVEL SECURITY;

-- Reps see their own earnings only
CREATE POLICY "Reps view own earnings"
  ON public.commission_earnings FOR SELECT
  USING (
    user_id = auth.uid()
    AND organization_id = public.get_user_org_id(auth.uid())
  );

-- Owners see every earning in their org
CREATE POLICY "Owners view all earnings in org"
  ON public.commission_earnings FOR SELECT
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

-- Only owners can manage (mark paid, void, edit, manually add)
CREATE POLICY "Owners manage earnings"
  ON public.commission_earnings FOR ALL
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

CREATE TRIGGER update_commission_earnings_updated_at
  BEFORE UPDATE ON public.commission_earnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Expenses — lightweight cost ledger for P&L
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  category TEXT NOT NULL DEFAULT 'other', -- 'ads' | 'tools' | 'salary' | 'other'
  vendor TEXT,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  incurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON public.expenses(organization_id, incurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(organization_id, category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view expenses"
  ON public.expenses FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Owners and managers manage expenses"
  ON public.expenses FOR ALL
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'manager'::app_role, organization_id)
    )
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'manager'::app_role, organization_id)
    )
  );

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Auto-create commission earning when lead is moved to 'won'
CREATE OR REPLACE FUNCTION public.handle_lead_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.commission_rules%ROWTYPE;
  v_rep_user_id UUID;
  v_commission_cents BIGINT;
BEGIN
  -- Only fire when status transitions INTO 'won'
  IF NEW.status <> 'won' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'won' THEN
    RETURN NEW;
  END IF;

  -- Need a deal value to calculate
  IF NEW.deal_value_cents IS NULL OR NEW.deal_value_cents <= 0 THEN
    RETURN NEW;
  END IF;

  -- Stamp closed_at + closed_by if missing
  IF NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  IF NEW.closed_by_user_id IS NULL THEN
    NEW.closed_by_user_id := auth.uid();
  END IF;
  v_rep_user_id := NEW.closed_by_user_id;

  -- Skip if we have no rep to attribute to
  IF v_rep_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find applicable rule: per-user override first, then org default
  SELECT * INTO v_rule
  FROM public.commission_rules
  WHERE organization_id = NEW.organization_id
    AND user_id = v_rep_user_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_rule
    FROM public.commission_rules
    WHERE organization_id = NEW.organization_id
      AND user_id IS NULL
      AND is_active = true
    LIMIT 1;
  END IF;

  -- No rule = no auto earning (org hasn't configured commissions)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_commission_cents := CASE
    WHEN v_rule.rule_type = 'flat' THEN v_rule.flat_cents
    ELSE FLOOR(NEW.deal_value_cents * v_rule.percent)::BIGINT
  END;

  -- Avoid duplicate if trigger fires twice for same lead
  IF EXISTS (
    SELECT 1 FROM public.commission_earnings
    WHERE lead_id = NEW.id AND user_id = v_rep_user_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commission_earnings (
    organization_id, user_id, lead_id,
    deal_value_cents, commission_cents, currency,
    rule_snapshot, status
  )
  VALUES (
    NEW.organization_id, v_rep_user_id, NEW.id,
    NEW.deal_value_cents, v_commission_cents, NEW.deal_currency,
    jsonb_build_object(
      'rule_type', v_rule.rule_type,
      'percent', v_rule.percent,
      'flat_cents', v_rule.flat_cents,
      'rule_id', v_rule.id
    ),
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_won ON public.leads;
CREATE TRIGGER trg_lead_won
  BEFORE INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_won();

-- 6. Mark earning paid (owner-only RPC for audit + permission check)
CREATE OR REPLACE FUNCTION public.mark_earning_paid(
  p_earning_id UUID,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org_id UUID;
  v_status TEXT;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT organization_id, status INTO v_org_id, v_status
  FROM public.commission_earnings WHERE id = p_earning_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Earning not found');
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role, v_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  IF v_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paid');
  END IF;

  UPDATE public.commission_earnings
  SET status = 'paid',
      paid_at = now(),
      payment_reference = NULLIF(TRIM(p_payment_reference), ''),
      updated_at = now()
  WHERE id = p_earning_id;

  RETURN jsonb_build_object('success', true);
END;
$$;