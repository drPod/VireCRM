-- 1. Add credit columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS monthly_credit_quota INTEGER NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS credits_used_this_period INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  ADD COLUMN IF NOT EXISTS unlimited_credits BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill quotas based on existing plan column
-- starter -> 250, professional -> 1500, enterprise -> unlimited
UPDATE public.organizations SET
  monthly_credit_quota = CASE plan
    WHEN 'starter' THEN 250
    WHEN 'professional' THEN 1500
    WHEN 'enterprise' THEN 999999
    ELSE 250
  END,
  unlimited_credits = (plan = 'enterprise');

-- 3. Consume credit RPC
CREATE OR REPLACE FUNCTION public.consume_credit(p_org_id UUID, p_count INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_current_month TIMESTAMPTZ := date_trunc('month', now());
  v_new_used INTEGER;
BEGIN
  SELECT id, monthly_credit_quota, credits_used_this_period, credit_period_start, unlimited_credits
  INTO v_org
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'org_not_found');
  END IF;

  -- Ownership / one-time tiers bypass credits entirely
  IF v_org.unlimited_credits THEN
    RETURN jsonb_build_object('ok', true, 'unlimited', true);
  END IF;

  -- Monthly reset
  IF v_org.credit_period_start < v_current_month THEN
    UPDATE public.organizations
    SET credits_used_this_period = 0, credit_period_start = v_current_month
    WHERE id = p_org_id;
    v_org.credits_used_this_period := 0;
  END IF;

  v_new_used := v_org.credits_used_this_period + p_count;

  IF v_new_used > v_org.monthly_credit_quota THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'credits_exhausted',
      'used', v_org.credits_used_this_period,
      'quota', v_org.monthly_credit_quota,
      'remaining', GREATEST(v_org.monthly_credit_quota - v_org.credits_used_this_period, 0)
    );
  END IF;

  UPDATE public.organizations
  SET credits_used_this_period = v_new_used
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'used', v_new_used,
    'quota', v_org.monthly_credit_quota,
    'remaining', v_org.monthly_credit_quota - v_new_used
  );
END;
$$;

-- 4. Get usage RPC (callable by org members)
CREATE OR REPLACE FUNCTION public.get_credit_usage(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_current_month TIMESTAMPTZ := date_trunc('month', now());
  v_used INTEGER;
BEGIN
  IF NOT public.user_belongs_to_org(auth.uid(), p_org_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT monthly_credit_quota, credits_used_this_period, credit_period_start, unlimited_credits
  INTO v_org
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_org.unlimited_credits THEN
    RETURN jsonb_build_object(
      'unlimited', true,
      'used', v_org.credits_used_this_period,
      'quota', null,
      'remaining', null,
      'period_end', v_current_month + INTERVAL '1 month'
    );
  END IF;

  v_used := CASE WHEN v_org.credit_period_start < v_current_month THEN 0 ELSE v_org.credits_used_this_period END;

  RETURN jsonb_build_object(
    'unlimited', false,
    'used', v_used,
    'quota', v_org.monthly_credit_quota,
    'remaining', GREATEST(v_org.monthly_credit_quota - v_used, 0),
    'period_end', v_current_month + INTERVAL '1 month'
  );
END;
$$;