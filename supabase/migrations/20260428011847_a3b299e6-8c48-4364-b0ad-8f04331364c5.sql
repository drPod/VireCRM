CREATE OR REPLACE FUNCTION public.credit_plan_for_price(p_price_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_price_key IS NULL THEN
    RETURN jsonb_build_object('quota', 250, 'unlimited', false, 'plan', 'starter');
  END IF;

  -- Ownership / one-time / custom tiers => unlimited, no credit usage
  IF p_price_key IN (
    'crm_ownership_onetime',
    'crm_custom_onetime',
    'crm_custom_setup',
    'custom_enterprise',
    'ownership_full',
    'ownership',
    'custom',
    'enterprise'
  ) OR p_price_key ILIKE '%ownership%'
    OR p_price_key ILIKE '%custom_crm%'
    OR p_price_key ILIKE 'custom%'
  THEN
    RETURN jsonb_build_object('quota', 0, 'unlimited', true, 'plan', 'ownership');
  END IF;

  -- Subscription tiers — accept both full price keys and short plan names
  IF p_price_key IN ('crm_starter_monthly', 'crm_starter', 'starter') THEN
    RETURN jsonb_build_object('quota', 250, 'unlimited', false, 'plan', 'starter');
  ELSIF p_price_key IN ('crm_growth_monthly', 'crm_growth', 'growth') THEN
    RETURN jsonb_build_object('quota', 1500, 'unlimited', false, 'plan', 'growth');
  ELSIF p_price_key IN ('crm_pro_monthly', 'crm_pro', 'pro') THEN
    RETURN jsonb_build_object('quota', 7500, 'unlimited', false, 'plan', 'pro');
  ELSIF p_price_key IN ('lease_starter_monthly', 'lease_starter') THEN
    RETURN jsonb_build_object('quota', 750, 'unlimited', false, 'plan', 'lease_starter');
  ELSIF p_price_key IN ('lease_pro_monthly', 'lease_pro', 'lease_professional') THEN
    RETURN jsonb_build_object('quota', 10000, 'unlimited', false, 'plan', 'lease_pro');
  END IF;

  -- Default fallback
  RETURN jsonb_build_object('quota', 250, 'unlimited', false, 'plan', 'starter');
END;
$function$;