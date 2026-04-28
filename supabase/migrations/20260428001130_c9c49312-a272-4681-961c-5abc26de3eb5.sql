-- =========================================================================
-- 1. Credit packs (purchased top-ups)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  purchased_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pack_key TEXT NOT NULL,                 -- e.g. credit_pack_small / medium / large / bulk
  credits_total INTEGER NOT NULL CHECK (credits_total > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
  amount_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  source TEXT NOT NULL DEFAULT 'manual',  -- 'checkout' | 'auto_recharge' | 'manual'
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  exhausted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_packs_org_active
  ON public.credit_packs (organization_id, expires_at)
  WHERE credits_remaining > 0;

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view credit packs"
  ON public.credit_packs FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "No direct writes to credit packs"
  ON public.credit_packs FOR INSERT TO authenticated WITH CHECK (false);

CREATE TRIGGER trg_credit_packs_updated
  BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2. Per-org auto-recharge settings
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.org_credit_settings (
  organization_id UUID NOT NULL PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_recharge_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_recharge_pack_key TEXT,                  -- which pack to buy when triggered
  auto_recharge_threshold_pct INTEGER NOT NULL DEFAULT 20 CHECK (auto_recharge_threshold_pct BETWEEN 1 AND 90),
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,                -- saved card for off-session charges
  last_auto_recharge_at TIMESTAMPTZ,
  last_auto_recharge_status TEXT,               -- 'succeeded' | 'failed' | null
  last_auto_recharge_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_credit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view credit settings"
  ON public.org_credit_settings FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can update credit settings"
  ON public.org_credit_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role, organization_id))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role, organization_id));

CREATE POLICY "Owners can insert credit settings"
  ON public.org_credit_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role, organization_id));

CREATE TRIGGER trg_org_credit_settings_updated
  BEFORE UPDATE ON public.org_credit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. Grant a credit pack (called by the payment webhook)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.grant_credit_pack(
  p_org_id UUID,
  p_pack_key TEXT,
  p_credits INTEGER,
  p_purchased_by UUID DEFAULT NULL,
  p_amount_cents INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT 'usd',
  p_source TEXT DEFAULT 'checkout',
  p_stripe_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack_id UUID;
BEGIN
  IF p_credits <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credits');
  END IF;

  -- Idempotency: if we already inserted this stripe session, return the existing pack
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT id INTO v_pack_id FROM public.credit_packs WHERE stripe_session_id = p_stripe_session_id;
    IF v_pack_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'pack_id', v_pack_id, 'duplicate', true);
    END IF;
  END IF;

  INSERT INTO public.credit_packs (
    organization_id, purchased_by, pack_key,
    credits_total, credits_remaining,
    amount_cents, currency, source,
    stripe_session_id, stripe_payment_intent_id
  ) VALUES (
    p_org_id, p_purchased_by, p_pack_key,
    p_credits, p_credits,
    p_amount_cents, COALESCE(p_currency, 'usd'), COALESCE(p_source, 'checkout'),
    p_stripe_session_id, p_stripe_payment_intent_id
  ) RETURNING id INTO v_pack_id;

  -- Audit log: log the grant as an "incoming" credit event
  INSERT INTO public.credit_usage_log (
    organization_id, user_id, action, command_id, lead_id,
    credits_charged, credits_before, credits_after, quota,
    unlimited, status, metadata
  ) VALUES (
    p_org_id, p_purchased_by, 'credit_pack_granted',
    p_stripe_session_id, NULL,
    -p_credits, NULL, NULL, NULL,
    false, 'consumed',
    jsonb_build_object('pack_id', v_pack_id, 'pack_key', p_pack_key, 'source', p_source, 'amount_cents', p_amount_cents)
  );

  RETURN jsonb_build_object('ok', true, 'pack_id', v_pack_id);
END;
$$;

-- =========================================================================
-- 4. Replace consume_credit so it falls back to credit packs after the
--    monthly quota is exhausted. Charges 1 unit (p_count) per call. Packs
--    are drawn FIFO by soonest expiry.
-- =========================================================================
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
  v_pack RECORD;
  v_pack_balance_before INTEGER;
  v_pack_balance_after INTEGER;
BEGIN
  SELECT id, monthly_credit_quota, credits_used_this_period, credit_period_start, unlimited_credits
  INTO v_org
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'org_not_found');
  END IF;

  -- Unlimited tier: bypass charge but still log
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

  -- Path A: monthly quota covers it
  IF v_new_used <= v_org.monthly_credit_quota THEN
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
      'source', 'monthly_quota',
      'used', v_new_used,
      'quota', v_org.monthly_credit_quota,
      'remaining', v_org.monthly_credit_quota - v_new_used,
      'log_id', v_log_id
    );
  END IF;

  -- Path B: monthly quota exhausted — try to draw from a credit pack
  SELECT id, credits_remaining, pack_key, expires_at
    INTO v_pack
  FROM public.credit_packs
  WHERE organization_id = p_org_id
    AND credits_remaining >= p_count
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_pack IS NOT NULL THEN
    v_pack_balance_before := v_pack.credits_remaining;
    v_pack_balance_after := v_pack.credits_remaining - p_count;

    UPDATE public.credit_packs
    SET credits_remaining = v_pack_balance_after,
        exhausted_at = CASE WHEN v_pack_balance_after = 0 THEN now() ELSE exhausted_at END
    WHERE id = v_pack.id;

    INSERT INTO public.credit_usage_log (
      organization_id, user_id, action, command_id, lead_id,
      credits_charged, credits_before, credits_after, quota,
      unlimited, status, metadata
    ) VALUES (
      p_org_id, v_caller, p_action, p_command_id, p_lead_id,
      p_count, v_before, v_before, v_org.monthly_credit_quota,
      false, 'consumed',
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'credit_pack',
        'pack_id', v_pack.id,
        'pack_key', v_pack.pack_key,
        'pack_balance_before', v_pack_balance_before,
        'pack_balance_after', v_pack_balance_after
      )
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
      'ok', true,
      'source', 'credit_pack',
      'pack_id', v_pack.id,
      'pack_remaining', v_pack_balance_after,
      'used', v_before,
      'quota', v_org.monthly_credit_quota,
      'log_id', v_log_id
    );
  END IF;

  -- Path C: no pack available either — reject
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
END;
$$;

-- =========================================================================
-- 5. Helper view: total live pack credits per org (for the widget)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_pack_credit_balance(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(credits_remaining), 0)::INTEGER
  FROM public.credit_packs
  WHERE organization_id = p_org_id
    AND credits_remaining > 0
    AND expires_at > now()
$$;