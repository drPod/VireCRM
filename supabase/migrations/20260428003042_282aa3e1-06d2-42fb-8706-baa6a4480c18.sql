
ALTER TABLE public.org_credit_settings
  ADD COLUMN IF NOT EXISTS low_balance_notify_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_balance_threshold INTEGER NOT NULL DEFAULT 50 CHECK (low_balance_threshold >= 0),
  ADD COLUMN IF NOT EXISTS low_balance_last_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_balance_last_notified_balance INTEGER;

-- Atomic check: returns whether a low-balance notification should fire right now.
-- Marks last_notified_at when it returns should_notify=true so callers can't double-send.
-- Cooldown: 24h. Resets implicitly once balance recovers above threshold (next dip re-triggers).
CREATE OR REPLACE FUNCTION public.check_and_mark_low_balance(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_balance INTEGER;
  v_cooldown INTERVAL := INTERVAL '24 hours';
BEGIN
  SELECT low_balance_notify_enabled, low_balance_threshold, low_balance_last_notified_at, low_balance_last_notified_balance
    INTO v_settings
    FROM public.org_credit_settings
    WHERE organization_id = p_org_id
    FOR UPDATE;

  IF NOT FOUND OR NOT v_settings.low_balance_notify_enabled THEN
    RETURN jsonb_build_object('should_notify', false, 'reason', 'disabled');
  END IF;

  -- Sum unexpired pack credits
  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_balance
    FROM public.credit_packs
    WHERE organization_id = p_org_id
      AND credits_remaining > 0
      AND expires_at > now();

  IF v_balance >= v_settings.low_balance_threshold THEN
    RETURN jsonb_build_object('should_notify', false, 'reason', 'above_threshold', 'balance', v_balance);
  END IF;

  -- Within cooldown? skip
  IF v_settings.low_balance_last_notified_at IS NOT NULL
     AND v_settings.low_balance_last_notified_at > (now() - v_cooldown) THEN
    RETURN jsonb_build_object('should_notify', false, 'reason', 'cooldown', 'balance', v_balance);
  END IF;

  UPDATE public.org_credit_settings
    SET low_balance_last_notified_at = now(),
        low_balance_last_notified_balance = v_balance
    WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'should_notify', true,
    'balance', v_balance,
    'threshold', v_settings.low_balance_threshold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_mark_low_balance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_mark_low_balance(UUID) TO authenticated, service_role;
