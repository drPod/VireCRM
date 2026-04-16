-- ============================================================
-- Transactions table: source of truth for reseller payout math
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paddle_transaction_id TEXT NOT NULL UNIQUE,
  paddle_subscription_id TEXT,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID,
  attributed_reseller_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'completed',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  billed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_reseller_period_idx
  ON public.transactions(attributed_reseller_id, billed_at)
  WHERE attributed_reseller_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_subscription_idx
  ON public.transactions(subscription_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages transactions"
  ON public.transactions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Reseller owners view attributed transactions"
  ON public.transactions FOR SELECT
  USING (
    attributed_reseller_id IS NOT NULL
    AND has_role(auth.uid(), 'owner'::app_role, attributed_reseller_id)
  );

CREATE POLICY "Users view own transactions"
  ON public.transactions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- Rewrite payout calculation to sum real transaction amounts
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_reseller_payouts(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller RECORD;
  v_payout_id UUID;
  v_existing_status TEXT;
  v_gross BIGINT;
  v_active_count INTEGER;
  v_currency TEXT;
  v_total_payouts INTEGER := 0;
  v_total_commission BIGINT := 0;
BEGIN
  -- Loop each reseller that has any attributed transactions in the period
  FOR v_reseller IN
    SELECT DISTINCT o.id, o.commission_rate, o.name
    FROM public.organizations o
    JOIN public.transactions t ON t.attributed_reseller_id = o.id
    WHERE o.is_reseller = true
      AND t.billed_at >= p_period_start
      AND t.billed_at < p_period_end + INTERVAL '1 day'
      AND t.status = 'completed'
  LOOP
    -- Sum real transaction amounts for this reseller in the period
    SELECT
      COALESCE(SUM(t.amount_cents), 0),
      COUNT(DISTINCT t.subscription_id),
      COALESCE(MAX(t.currency), 'USD')
    INTO v_gross, v_active_count, v_currency
    FROM public.transactions t
    WHERE t.attributed_reseller_id = v_reseller.id
      AND t.billed_at >= p_period_start
      AND t.billed_at < p_period_end + INTERVAL '1 day'
      AND t.status = 'completed';

    IF v_gross <= 0 THEN
      CONTINUE;
    END IF;

    -- Check if a payout already exists; never mutate a finalized one
    SELECT id, status INTO v_payout_id, v_existing_status
    FROM public.reseller_payouts
    WHERE reseller_id = v_reseller.id AND period_start = p_period_start;

    IF v_payout_id IS NOT NULL AND v_existing_status IN ('paid', 'void') THEN
      CONTINUE;
    END IF;

    -- Upsert the payout summary
    INSERT INTO public.reseller_payouts (
      reseller_id, period_start, period_end,
      gross_revenue_cents, commission_rate, commission_cents,
      active_client_count, currency, status
    )
    VALUES (
      v_reseller.id, p_period_start, p_period_end,
      v_gross, v_reseller.commission_rate,
      FLOOR(v_gross * v_reseller.commission_rate)::BIGINT,
      v_active_count, v_currency, 'pending'
    )
    ON CONFLICT (reseller_id, period_start) DO UPDATE
      SET gross_revenue_cents = EXCLUDED.gross_revenue_cents,
          commission_cents = EXCLUDED.commission_cents,
          commission_rate = EXCLUDED.commission_rate,
          active_client_count = EXCLUDED.active_client_count,
          currency = EXCLUDED.currency,
          updated_at = now()
    RETURNING id INTO v_payout_id;

    -- Refresh non-refund line items (preserve refund adjustments which carry refund_transaction_id)
    DELETE FROM public.payout_line_items
    WHERE payout_id = v_payout_id
      AND refund_transaction_id IS NULL;

    -- One line item per real transaction
    INSERT INTO public.payout_line_items (
      payout_id, subscription_id, client_org_id, client_name,
      amount_cents, commission_cents
    )
    SELECT
      v_payout_id,
      t.subscription_id,
      o.id,
      o.name,
      t.amount_cents,
      FLOOR(t.amount_cents * v_reseller.commission_rate)::BIGINT
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    LEFT JOIN public.organizations o ON o.id = p.organization_id
    WHERE t.attributed_reseller_id = v_reseller.id
      AND t.billed_at >= p_period_start
      AND t.billed_at < p_period_end + INTERVAL '1 day'
      AND t.status = 'completed';

    -- Recalculate totals from all line items (includes any negative refund adjustments)
    UPDATE public.reseller_payouts
    SET gross_revenue_cents = COALESCE((
          SELECT SUM(amount_cents) FROM public.payout_line_items WHERE payout_id = v_payout_id
        ), 0),
        commission_cents = COALESCE((
          SELECT SUM(commission_cents) FROM public.payout_line_items WHERE payout_id = v_payout_id
        ), 0),
        updated_at = now()
    WHERE id = v_payout_id;

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