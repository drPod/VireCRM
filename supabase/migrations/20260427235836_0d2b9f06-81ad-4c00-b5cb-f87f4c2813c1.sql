-- Audit log for every credit-consuming action
CREATE TABLE IF NOT EXISTS public.credit_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                -- e.g. 'outreach_ai_generate', 'outreach_send'
  command_id TEXT,                     -- caller-provided correlation id (per UI action / batch)
  lead_id UUID,                        -- optional related lead
  credits_charged INTEGER NOT NULL DEFAULT 1,
  credits_before INTEGER,              -- null when unlimited
  credits_after INTEGER,               -- null when unlimited
  quota INTEGER,                       -- snapshot of monthly_credit_quota at time of charge
  unlimited BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'consumed', -- 'consumed' | 'rejected_quota' | 'bypass_unlimited'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_log_org_created
  ON public.credit_usage_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_command
  ON public.credit_usage_log (command_id) WHERE command_id IS NOT NULL;

ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's audit trail
CREATE POLICY "Org members can view credit usage log"
  ON public.credit_usage_log FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Inserts only via SECURITY DEFINER RPC; deny direct writes from clients
CREATE POLICY "No direct inserts to credit usage log"
  ON public.credit_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Replace consume_credit RPC: accept audit metadata + write a log row on every call
CREATE OR REPLACE FUNCTION public.consume_credit(
  p_org_id UUID,
  p_count INTEGER DEFAULT 1,
  p_user_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT 'unknown',
  p_command_id TEXT DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_current_month TIMESTAMPTZ := date_trunc('month', now());
  v_before INTEGER;
  v_new_used INTEGER;
  v_log_id UUID;
  v_caller UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  SELECT id, monthly_credit_quota, credits_used_this_period, credit_period_start, unlimited_credits
  INTO v_org
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'org_not_found');
  END IF;

  -- Unlimited tier: bypass charge but still log the action
  IF v_org.unlimited_credits THEN
    INSERT INTO public.credit_usage_log (
      organization_id, user_id, action, command_id, lead_id,
      credits_charged, credits_before, credits_after, quota,
      unlimited, status, metadata
    ) VALUES (
      p_org_id, v_caller, p_action, p_command_id, p_lead_id,
      0, NULL, NULL, NULL,
      true, 'bypass_unlimited', COALESCE(p_metadata, '{}'::jsonb)
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object('ok', true, 'unlimited', true, 'log_id', v_log_id);
  END IF;

  -- Monthly reset
  IF v_org.credit_period_start < v_current_month THEN
    UPDATE public.organizations
    SET credits_used_this_period = 0, credit_period_start = v_current_month
    WHERE id = p_org_id;
    v_org.credits_used_this_period := 0;
  END IF;

  v_before := v_org.credits_used_this_period;
  v_new_used := v_before + p_count;

  IF v_new_used > v_org.monthly_credit_quota THEN
    INSERT INTO public.credit_usage_log (
      organization_id, user_id, action, command_id, lead_id,
      credits_charged, credits_before, credits_after, quota,
      unlimited, status, metadata
    ) VALUES (
      p_org_id, v_caller, p_action, p_command_id, p_lead_id,
      0, v_before, v_before, v_org.monthly_credit_quota,
      false, 'rejected_quota', COALESCE(p_metadata, '{}'::jsonb)
    );

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'credits_exhausted',
      'used', v_before,
      'quota', v_org.monthly_credit_quota,
      'remaining', GREATEST(v_org.monthly_credit_quota - v_before, 0)
    );
  END IF;

  UPDATE public.organizations
  SET credits_used_this_period = v_new_used
  WHERE id = p_org_id;

  INSERT INTO public.credit_usage_log (
    organization_id, user_id, action, command_id, lead_id,
    credits_charged, credits_before, credits_after, quota,
    unlimited, status, metadata
  ) VALUES (
    p_org_id, v_caller, p_action, p_command_id, p_lead_id,
    p_count, v_before, v_new_used, v_org.monthly_credit_quota,
    false, 'consumed', COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'ok', true,
    'used', v_new_used,
    'quota', v_org.monthly_credit_quota,
    'remaining', v_org.monthly_credit_quota - v_new_used,
    'log_id', v_log_id
  );
END;
$$;