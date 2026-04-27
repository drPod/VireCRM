-- 1. Pure mapping: price lookup key -> { quota, unlimited }
CREATE OR REPLACE FUNCTION public.credit_plan_for_price(p_price_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_price_key IS NULL THEN
    RETURN jsonb_build_object('quota', 250, 'unlimited', false, 'plan', 'starter');
  END IF;

  -- Ownership / one-time tiers => unlimited, no credit usage
  IF p_price_key IN (
    'crm_ownership_onetime',
    'crm_custom_onetime',
    'crm_custom_setup',
    'custom_enterprise',
    'ownership_full'
  ) OR p_price_key ILIKE '%ownership%'
    OR p_price_key ILIKE '%custom_crm%'
  THEN
    RETURN jsonb_build_object('quota', 0, 'unlimited', true, 'plan', 'ownership');
  END IF;

  -- Subscription tiers
  IF p_price_key = 'crm_starter_monthly' THEN
    RETURN jsonb_build_object('quota', 250, 'unlimited', false, 'plan', 'starter');
  ELSIF p_price_key = 'crm_growth_monthly' THEN
    RETURN jsonb_build_object('quota', 1500, 'unlimited', false, 'plan', 'growth');
  ELSIF p_price_key = 'crm_pro_monthly' THEN
    RETURN jsonb_build_object('quota', 7500, 'unlimited', false, 'plan', 'pro');
  ELSIF p_price_key = 'lease_starter_monthly' THEN
    RETURN jsonb_build_object('quota', 750, 'unlimited', false, 'plan', 'lease_starter');
  ELSIF p_price_key = 'lease_pro_monthly' THEN
    RETURN jsonb_build_object('quota', 10000, 'unlimited', false, 'plan', 'lease_pro');
  END IF;

  -- Default fallback
  RETURN jsonb_build_object('quota', 250, 'unlimited', false, 'plan', 'starter');
END;
$$;

-- 2. Apply the credit plan to an organization (used by webhook + backfill)
CREATE OR REPLACE FUNCTION public.apply_credit_plan(p_org_id UUID, p_price_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan JSONB := public.credit_plan_for_price(p_price_key);
BEGIN
  UPDATE public.organizations
  SET monthly_credit_quota = (v_plan->>'quota')::INT,
      unlimited_credits   = (v_plan->>'unlimited')::BOOLEAN,
      plan                = v_plan->>'plan'
  WHERE id = p_org_id;

  RETURN v_plan;
END;
$$;

-- 3. Backfill: for every org with an active subscription, sync their credit plan
--    based on the most recent active subscription's price lookup key.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.organization_id)
      p.organization_id,
      s.price_id
    FROM public.subscriptions s
    JOIN public.profiles p ON p.user_id = s.user_id
    WHERE s.status IN ('active', 'trialing', 'past_due')
      AND p.organization_id IS NOT NULL
    ORDER BY p.organization_id, s.updated_at DESC NULLS LAST
  LOOP
    PERFORM public.apply_credit_plan(r.organization_id, r.price_id);
  END LOOP;
END $$;