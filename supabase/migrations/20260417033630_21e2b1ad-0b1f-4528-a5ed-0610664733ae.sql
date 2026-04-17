-- ============================================================
-- PILLAR 1: PER-TENANT REBILLING
-- ============================================================

-- 1. reseller_plans: white-labeled plans defined by each reseller
CREATE TABLE public.reseller_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  -- Maps to one of our underlying base price IDs (e.g. "starter_monthly", "pro_monthly")
  base_price_id TEXT NOT NULL,
  -- Our cost per month for this base tier, in cents (cached for payout math).
  base_cost_cents BIGINT NOT NULL,
  -- Markup as a decimal (0.5 = +50%). Reseller earns markup × base on each renewal.
  markup_percent NUMERIC(6, 4) NOT NULL DEFAULT 0.5000 CHECK (markup_percent >= 0 AND markup_percent <= 10),
  -- Cached: base_cost_cents * (1 + markup_percent), what the client pays per month.
  monthly_price_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- URL-safe slug for /r/{reseller_slug}/checkout/{plan_slug}
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, slug)
);

CREATE INDEX idx_reseller_plans_reseller ON public.reseller_plans(reseller_id) WHERE is_active = true;

ALTER TABLE public.reseller_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller owners manage own plans"
  ON public.reseller_plans
  FOR ALL
  USING (public.has_role(auth.uid(), 'owner'::app_role, reseller_id))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role, reseller_id));

CREATE POLICY "Reseller members view own plans"
  ON public.reseller_plans
  FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), reseller_id));

CREATE TRIGGER trg_reseller_plans_updated_at
  BEFORE UPDATE ON public.reseller_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Public read function for the checkout page (anonymous visitors)
CREATE OR REPLACE FUNCTION public.get_reseller_plan_public(
  p_reseller_slug TEXT,
  p_plan_slug TEXT
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'plan_id', rp.id,
    'reseller_id', o.id,
    'reseller_slug', o.slug,
    'reseller_brand_name', o.brand_name,
    'reseller_logo_url', o.logo_url,
    'reseller_primary_color', o.primary_color,
    'plan_name', rp.name,
    'plan_description', rp.description,
    'features', rp.features,
    'base_price_id', rp.base_price_id,
    'monthly_price_cents', rp.monthly_price_cents,
    'currency', rp.currency
  )
  FROM public.reseller_plans rp
  JOIN public.organizations o ON o.id = rp.reseller_id
  WHERE o.slug = p_reseller_slug
    AND rp.slug = p_plan_slug
    AND rp.is_active = true
    AND o.is_reseller = true
  LIMIT 1
$$;

-- 3. List active plans for a reseller (used on signup page to show options)
CREATE OR REPLACE FUNCTION public.list_reseller_plans_public(p_reseller_slug TEXT)
RETURNS TABLE (
  plan_id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  features TEXT[],
  monthly_price_cents BIGINT,
  currency TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rp.id, rp.slug, rp.name, rp.description, rp.features, rp.monthly_price_cents, rp.currency
  FROM public.reseller_plans rp
  JOIN public.organizations o ON o.id = rp.reseller_id
  WHERE o.slug = p_reseller_slug
    AND o.is_reseller = true
    AND rp.is_active = true
  ORDER BY rp.monthly_price_cents ASC
$$;

-- 4. Add reseller_plan_id to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN reseller_plan_id UUID REFERENCES public.reseller_plans(id) ON DELETE SET NULL;

CREATE INDEX idx_subscriptions_reseller_plan ON public.subscriptions(reseller_plan_id) WHERE reseller_plan_id IS NOT NULL;

-- 5. Split payout line items into base cost vs markup
ALTER TABLE public.payout_line_items
  ADD COLUMN base_cost_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN markup_cents BIGINT NOT NULL DEFAULT 0;

-- 6. Track per-transaction reseller plan attribution so we can compute markup on the fly
ALTER TABLE public.transactions
  ADD COLUMN reseller_plan_id UUID REFERENCES public.reseller_plans(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_reseller_plan ON public.transactions(reseller_plan_id) WHERE reseller_plan_id IS NOT NULL;

-- 7. Rewrite calculate_reseller_payouts to handle BOTH:
--    (a) New markup-based plans: reseller earns (transaction_amount - plan.base_cost_cents)
--    (b) Legacy commission %: reseller earns transaction_amount * org.commission_rate
CREATE OR REPLACE FUNCTION public.calculate_reseller_payouts(p_period_start date, p_period_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  FOR v_reseller IN
    SELECT DISTINCT o.id, o.commission_rate, o.name
    FROM public.organizations o
    JOIN public.transactions t ON t.attributed_reseller_id = o.id
    WHERE o.is_reseller = true
      AND t.billed_at >= p_period_start
      AND t.billed_at < p_period_end + INTERVAL '1 day'
      AND t.status = 'completed'
  LOOP
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

    SELECT id, status INTO v_payout_id, v_existing_status
    FROM public.reseller_payouts
    WHERE reseller_id = v_reseller.id AND period_start = p_period_start;

    IF v_payout_id IS NOT NULL AND v_existing_status IN ('paid', 'void') THEN
      CONTINUE;
    END IF;

    INSERT INTO public.reseller_payouts (
      reseller_id, period_start, period_end,
      gross_revenue_cents, commission_rate, commission_cents,
      active_client_count, currency, status
    )
    VALUES (
      v_reseller.id, p_period_start, p_period_end,
      v_gross, v_reseller.commission_rate, 0,
      v_active_count, v_currency, 'pending'
    )
    ON CONFLICT (reseller_id, period_start) DO UPDATE
      SET gross_revenue_cents = EXCLUDED.gross_revenue_cents,
          active_client_count = EXCLUDED.active_client_count,
          currency = EXCLUDED.currency,
          updated_at = now()
    RETURNING id INTO v_payout_id;

    -- Refresh non-refund line items
    DELETE FROM public.payout_line_items
    WHERE payout_id = v_payout_id
      AND refund_transaction_id IS NULL;

    -- One line item per real transaction.
    -- For markup plans: base_cost = plan.base_cost_cents, markup = txn.amount - base_cost,
    --   reseller earns the markup portion.
    -- For legacy (no plan): base_cost = txn.amount * (1 - commission_rate), markup = 0,
    --   reseller earns txn.amount * commission_rate (stored as commission_cents).
    INSERT INTO public.payout_line_items (
      payout_id, subscription_id, client_org_id, client_name,
      amount_cents, base_cost_cents, markup_cents, commission_cents
    )
    SELECT
      v_payout_id,
      t.subscription_id,
      o.id,
      o.name,
      t.amount_cents,
      CASE
        WHEN rp.id IS NOT NULL THEN LEAST(rp.base_cost_cents, t.amount_cents)
        ELSE FLOOR(t.amount_cents * (1 - v_reseller.commission_rate))::BIGINT
      END AS base_cost_cents,
      CASE
        WHEN rp.id IS NOT NULL THEN GREATEST(t.amount_cents - rp.base_cost_cents, 0)
        ELSE 0
      END AS markup_cents,
      CASE
        WHEN rp.id IS NOT NULL THEN GREATEST(t.amount_cents - rp.base_cost_cents, 0)
        ELSE FLOOR(t.amount_cents * v_reseller.commission_rate)::BIGINT
      END AS commission_cents
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    LEFT JOIN public.organizations o ON o.id = p.organization_id
    LEFT JOIN public.reseller_plans rp ON rp.id = t.reseller_plan_id
    WHERE t.attributed_reseller_id = v_reseller.id
      AND t.billed_at >= p_period_start
      AND t.billed_at < p_period_end + INTERVAL '1 day'
      AND t.status = 'completed';

    -- Recalc totals from line items (includes any negative refund adjustments)
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
    v_total_commission := v_total_commission + (
      SELECT COALESCE(SUM(commission_cents), 0)
      FROM public.payout_line_items WHERE payout_id = v_payout_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'payouts_created', v_total_payouts,
    'total_commission_cents', v_total_commission
  );
END;
$function$;

-- 8. Rewrite apply_refund_adjustment for markup-aware deduction.
--    For markup plans: reseller loses ONLY the markup portion (we ate the base for what we paid Paddle).
--    For legacy: reseller loses commission_rate * refund_amount (existing behavior).
CREATE OR REPLACE FUNCTION public.apply_refund_adjustment(
  p_paddle_subscription_id text,
  p_refund_transaction_id text,
  p_refund_amount_cents bigint,
  p_refund_at timestamp with time zone,
  p_environment text DEFAULT 'live'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_reseller RECORD;
  v_plan RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_payout RECORD;
  v_base_refund_cents BIGINT;
  v_markup_refund_cents BIGINT;
  v_commission_loss_cents BIGINT;
  v_client_org_id UUID;
  v_client_name TEXT;
BEGIN
  IF p_refund_amount_cents IS NULL OR p_refund_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid refund amount');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payout_line_items
    WHERE refund_transaction_id = p_refund_transaction_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Already recorded');
  END IF;

  SELECT s.id, s.user_id, s.attributed_reseller_id, s.reseller_plan_id
    INTO v_subscription
  FROM public.subscriptions s
  WHERE s.paddle_subscription_id = p_paddle_subscription_id
    AND s.environment = p_environment
  LIMIT 1;

  IF v_subscription.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;

  IF v_subscription.attributed_reseller_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'No reseller attribution');
  END IF;

  SELECT id, commission_rate, name
    INTO v_reseller
  FROM public.organizations
  WHERE id = v_subscription.attributed_reseller_id;

  IF v_reseller.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reseller org missing');
  END IF;

  -- Compute the loss split.
  IF v_subscription.reseller_plan_id IS NOT NULL THEN
    SELECT base_cost_cents, monthly_price_cents
      INTO v_plan
    FROM public.reseller_plans
    WHERE id = v_subscription.reseller_plan_id;

    IF v_plan.monthly_price_cents IS NULL OR v_plan.monthly_price_cents <= 0 THEN
      v_base_refund_cents := p_refund_amount_cents;
      v_markup_refund_cents := 0;
    ELSE
      -- Pro-rate: if a partial refund, deduct the same proportion of base vs markup.
      v_base_refund_cents := FLOOR(
        p_refund_amount_cents * v_plan.base_cost_cents::NUMERIC / v_plan.monthly_price_cents::NUMERIC
      )::BIGINT;
      v_markup_refund_cents := p_refund_amount_cents - v_base_refund_cents;
    END IF;
    v_commission_loss_cents := v_markup_refund_cents;
  ELSE
    -- Legacy: split based on flat commission %
    v_base_refund_cents := FLOOR(p_refund_amount_cents * (1 - v_reseller.commission_rate))::BIGINT;
    v_markup_refund_cents := 0;
    v_commission_loss_cents := FLOOR(p_refund_amount_cents * v_reseller.commission_rate)::BIGINT;
  END IF;

  IF v_commission_loss_cents <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Zero commission impact');
  END IF;

  SELECT o.id, o.name INTO v_client_org_id, v_client_name
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.user_id = v_subscription.user_id
  LIMIT 1;

  v_period_start := date_trunc('month', p_refund_at)::DATE;
  v_period_end := (date_trunc('month', p_refund_at) + INTERVAL '1 month - 1 day')::DATE;

  SELECT id, status INTO v_payout
  FROM public.reseller_payouts
  WHERE reseller_id = v_reseller.id AND period_start = v_period_start
  LIMIT 1;

  -- If the matching payout is finalized, push the adjustment to current pending month
  IF v_payout.id IS NOT NULL AND v_payout.status IN ('paid', 'void') THEN
    v_period_start := date_trunc('month', now())::DATE;
    v_period_end := (date_trunc('month', now()) + INTERVAL '1 month - 1 day')::DATE;
    SELECT id, status INTO v_payout
    FROM public.reseller_payouts
    WHERE reseller_id = v_reseller.id AND period_start = v_period_start
    LIMIT 1;
  END IF;

  IF v_payout.id IS NULL THEN
    INSERT INTO public.reseller_payouts (
      reseller_id, period_start, period_end,
      gross_revenue_cents, commission_rate, commission_cents,
      active_client_count, status
    )
    VALUES (
      v_reseller.id, v_period_start, v_period_end,
      0, v_reseller.commission_rate, 0,
      0, 'pending'
    )
    RETURNING id, status INTO v_payout;
  END IF;

  INSERT INTO public.payout_line_items (
    payout_id, subscription_id, client_org_id, client_name,
    amount_cents, base_cost_cents, markup_cents, commission_cents,
    refund_transaction_id
  )
  VALUES (
    v_payout.id,
    v_subscription.id,
    v_client_org_id,
    COALESCE(v_client_name, 'Refunded client') || ' (refund)',
    -p_refund_amount_cents,
    -v_base_refund_cents,
    -v_markup_refund_cents,
    -v_commission_loss_cents,
    p_refund_transaction_id
  );

  UPDATE public.reseller_payouts
  SET gross_revenue_cents = COALESCE((
        SELECT SUM(amount_cents) FROM public.payout_line_items WHERE payout_id = v_payout.id
      ), 0),
      commission_cents = COALESCE((
        SELECT SUM(commission_cents) FROM public.payout_line_items WHERE payout_id = v_payout.id
      ), 0),
      updated_at = now()
  WHERE id = v_payout.id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout.id,
    'deducted_commission_cents', v_commission_loss_cents,
    'base_refund_cents', v_base_refund_cents,
    'markup_refund_cents', v_markup_refund_cents,
    'period_start', v_period_start
  );
END;
$function$;