-- Hybrid Apollo lead model: monthly platform-key quota per plan,
-- with BYO key bypass. Conservative caps: starter 25, growth/pro_lease 100, pro/lease_pro 500.

-- 1. Add quota tracking to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS monthly_lead_quota INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS leads_used_this_period INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now());

-- 2. Plan → quota mapping (single source of truth).
-- Matches conservative tier from the user: 25 / 100 / 500.
CREATE OR REPLACE FUNCTION public.lead_quota_for_plan(p_plan TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_plan IN ('starter', 'crm_starter', 'lease_starter') THEN 25
    WHEN p_plan IN ('growth', 'crm_growth') THEN 100
    WHEN p_plan IN ('pro', 'crm_pro', 'lease_pro', 'lease_professional') THEN 500
    WHEN p_plan IN ('enterprise', 'ownership', 'custom') THEN 999999
    ELSE 25
  END
$$;

-- 3. Backfill quotas based on each org's current plan.
UPDATE public.organizations
SET monthly_lead_quota = public.lead_quota_for_plan(plan)
WHERE monthly_lead_quota = 25; -- only touch defaults, don't overwrite manual overrides

-- 4. Atomic consume function: increments usage iff under quota,
-- auto-resets at month boundary. Returns the new state.
CREATE OR REPLACE FUNCTION public.consume_platform_lead_quota(
  p_org_id UUID,
  p_count INTEGER DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_current_month TIMESTAMPTZ := date_trunc('month', now());
  v_new_used INTEGER;
BEGIN
  SELECT id, monthly_lead_quota, leads_used_this_period, lead_period_start
    INTO v_org
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'org_not_found');
  END IF;

  -- Reset counter on new month
  IF v_org.lead_period_start < v_current_month THEN
    UPDATE public.organizations
    SET leads_used_this_period = 0, lead_period_start = v_current_month
    WHERE id = p_org_id;
    v_org.leads_used_this_period := 0;
  END IF;

  v_new_used := v_org.leads_used_this_period + p_count;

  IF v_new_used > v_org.monthly_lead_quota THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'used', v_org.leads_used_this_period,
      'quota', v_org.monthly_lead_quota,
      'remaining', GREATEST(v_org.monthly_lead_quota - v_org.leads_used_this_period, 0)
    );
  END IF;

  UPDATE public.organizations
  SET leads_used_this_period = v_new_used
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'used', v_new_used,
    'quota', v_org.monthly_lead_quota,
    'remaining', v_org.monthly_lead_quota - v_new_used
  );
END;
$$;

-- 5. Read-only helper for the UI (does not consume).
CREATE OR REPLACE FUNCTION public.get_lead_usage(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_current_month TIMESTAMPTZ := date_trunc('month', now());
  v_used INTEGER;
BEGIN
  -- Membership check
  IF NOT public.user_belongs_to_org(auth.uid(), p_org_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT monthly_lead_quota, leads_used_this_period, lead_period_start
    INTO v_org
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- If the period has rolled over, report 0 used (the next consume call will persist the reset)
  v_used := CASE WHEN v_org.lead_period_start < v_current_month THEN 0 ELSE v_org.leads_used_this_period END;

  RETURN jsonb_build_object(
    'used', v_used,
    'quota', v_org.monthly_lead_quota,
    'remaining', GREATEST(v_org.monthly_lead_quota - v_used, 0),
    'period_start', GREATEST(v_org.lead_period_start, v_current_month),
    'period_end', v_current_month + INTERVAL '1 month'
  );
END;
$$;

-- 6. Allow the special "platform" provider in org_integrations for the system row.
-- The platform key is stored as a singleton with a NULL organization_id and
-- provider='platform_apollo' — only the service role can read it.
ALTER TABLE public.org_integrations
  ALTER COLUMN organization_id DROP NOT NULL;

-- Block all client access to platform-level rows; only service_role policy already covers it.
CREATE POLICY "Block client access to platform integrations"
ON public.org_integrations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (organization_id IS NOT NULL)
WITH CHECK (organization_id IS NOT NULL);
