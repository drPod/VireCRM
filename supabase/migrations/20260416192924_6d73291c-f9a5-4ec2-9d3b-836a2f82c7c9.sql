-- 1. Commission rate per reseller
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.3000
    CHECK (commission_rate >= 0 AND commission_rate <= 1);

-- 2. Attribute each subscription to a reseller (NULL = direct customer, no reseller)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS attributed_reseller_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_attributed_reseller
  ON public.subscriptions(attributed_reseller_id)
  WHERE attributed_reseller_id IS NOT NULL;

-- 3. Reseller payouts (monthly summary, one row per reseller per period)
CREATE TABLE IF NOT EXISTS public.reseller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue_cents BIGINT NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  active_client_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reseller_id, period_start)
);

CREATE INDEX idx_reseller_payouts_reseller ON public.reseller_payouts(reseller_id, period_start DESC);

-- 4. Per-subscription line items inside each payout
CREATE TABLE IF NOT EXISTS public.payout_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES public.reseller_payouts(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  client_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  client_name TEXT,
  amount_cents BIGINT NOT NULL,
  commission_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payout_line_items_payout ON public.payout_line_items(payout_id);

-- 5. RLS
ALTER TABLE public.reseller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller owners view own payouts"
  ON public.reseller_payouts FOR SELECT
  USING (public.has_role(auth.uid(), 'owner'::app_role, reseller_id));

CREATE POLICY "Service role manages payouts"
  ON public.reseller_payouts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Reseller owners view own line items"
  ON public.payout_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reseller_payouts rp
      WHERE rp.id = payout_id
        AND public.has_role(auth.uid(), 'owner'::app_role, rp.reseller_id)
    )
  );

CREATE POLICY "Service role manages line items"
  ON public.payout_line_items FOR ALL
  USING (auth.role() = 'service_role');

-- 6. updated_at trigger
CREATE TRIGGER reseller_payouts_updated_at
  BEFORE UPDATE ON public.reseller_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Commission calculation function (idempotent — safe to re-run for same period)
CREATE OR REPLACE FUNCTION public.calculate_reseller_payouts(p_period_start DATE, p_period_end DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller RECORD;
  v_payout_id UUID;
  v_gross BIGINT;
  v_active_count INTEGER;
  v_total_payouts INTEGER := 0;
  v_total_commission BIGINT := 0;
BEGIN
  -- Loop each reseller that has any attributed subscriptions
  FOR v_reseller IN
    SELECT DISTINCT o.id, o.commission_rate, o.name
    FROM public.organizations o
    JOIN public.subscriptions s ON s.attributed_reseller_id = o.id
    WHERE o.is_reseller = true
  LOOP
    -- Sum gross revenue from active/trialing attributed subs in this period
    -- Simple model: each active subscription contributes its monthly equivalent
    -- (real implementation would sum actual transactions; this is a clean MVP)
    SELECT
      COALESCE(SUM(
        CASE
          -- Use a flat $29 per active attributed sub as MVP; refine when transactions are tracked
          WHEN s.status IN ('active', 'trialing') THEN 2900
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE s.status IN ('active', 'trialing'))
    INTO v_gross, v_active_count
    FROM public.subscriptions s
    WHERE s.attributed_reseller_id = v_reseller.id
      AND (s.current_period_end IS NULL OR s.current_period_end >= p_period_start)
      AND s.created_at < p_period_end + INTERVAL '1 day';

    IF v_gross = 0 THEN
      CONTINUE;
    END IF;

    -- Upsert payout summary
    INSERT INTO public.reseller_payouts (
      reseller_id, period_start, period_end,
      gross_revenue_cents, commission_rate, commission_cents,
      active_client_count, status
    )
    VALUES (
      v_reseller.id, p_period_start, p_period_end,
      v_gross, v_reseller.commission_rate,
      FLOOR(v_gross * v_reseller.commission_rate)::BIGINT,
      v_active_count, 'pending'
    )
    ON CONFLICT (reseller_id, period_start) DO UPDATE
      SET gross_revenue_cents = EXCLUDED.gross_revenue_cents,
          commission_cents = EXCLUDED.commission_cents,
          commission_rate = EXCLUDED.commission_rate,
          active_client_count = EXCLUDED.active_client_count,
          updated_at = now()
      WHERE public.reseller_payouts.status = 'pending'
    RETURNING id INTO v_payout_id;

    -- Skip line item refresh if payout was already paid/void
    IF v_payout_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Refresh line items for pending payouts
    DELETE FROM public.payout_line_items WHERE payout_id = v_payout_id;

    INSERT INTO public.payout_line_items (
      payout_id, subscription_id, client_org_id, client_name,
      amount_cents, commission_cents
    )
    SELECT
      v_payout_id,
      s.id,
      o.id,
      o.name,
      2900,
      FLOOR(2900 * v_reseller.commission_rate)::BIGINT
    FROM public.subscriptions s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
    LEFT JOIN public.organizations o ON o.id = p.organization_id
    WHERE s.attributed_reseller_id = v_reseller.id
      AND s.status IN ('active', 'trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end >= p_period_start);

    v_total_payouts := v_total_payouts + 1;
    v_total_commission := v_total_commission + FLOOR(v_gross * v_reseller.commission_rate)::BIGINT;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'payouts_created', v_total_payouts,
    'total_commission_cents', v_total_commission
  );
END;
$$;