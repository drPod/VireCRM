-- Track which Paddle transactions have already produced a refund adjustment so re-sent
-- webhooks (Paddle retries for 7 days) don't double-deduct commissions.
ALTER TABLE public.payout_line_items
  ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payout_line_items_refund_txn_unique
  ON public.payout_line_items(refund_transaction_id)
  WHERE refund_transaction_id IS NOT NULL;

-- Apply a refund as a negative adjustment line on the appropriate pending payout.
-- Strategy:
--   * Find the subscription by paddle_subscription_id (in this env) and read its reseller attribution.
--   * Find or create the pending payout for the period the refund falls into (calendar month of refund_at).
--   * Insert a negative line item proportional to: refund_amount_cents * commission_rate.
--   * If the existing payout for that period is already 'paid' or 'void', attach the negative line
--     to the next pending payout window (current calendar month) so we never mutate finalized payouts.
CREATE OR REPLACE FUNCTION public.apply_refund_adjustment(
  p_paddle_subscription_id TEXT,
  p_refund_transaction_id TEXT,
  p_refund_amount_cents BIGINT,
  p_refund_at TIMESTAMPTZ,
  p_environment TEXT DEFAULT 'live'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_reseller RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_payout RECORD;
  v_commission_cents BIGINT;
  v_client_org_id UUID;
  v_client_name TEXT;
BEGIN
  IF p_refund_amount_cents IS NULL OR p_refund_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid refund amount');
  END IF;

  -- Idempotency: if we've already recorded this refund, no-op.
  IF EXISTS (
    SELECT 1 FROM public.payout_line_items
    WHERE refund_transaction_id = p_refund_transaction_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Already recorded');
  END IF;

  -- Locate the subscription + its attributed reseller
  SELECT s.id, s.user_id, s.attributed_reseller_id
    INTO v_subscription
  FROM public.subscriptions s
  WHERE s.paddle_subscription_id = p_paddle_subscription_id
    AND s.environment = p_environment
  LIMIT 1;

  IF v_subscription.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;

  IF v_subscription.attributed_reseller_id IS NULL THEN
    -- Not a reseller-attributed sub — nothing to deduct.
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'No reseller attribution');
  END IF;

  SELECT id, commission_rate, name
    INTO v_reseller
  FROM public.organizations
  WHERE id = v_subscription.attributed_reseller_id;

  IF v_reseller.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reseller org missing');
  END IF;

  v_commission_cents := FLOOR(p_refund_amount_cents * v_reseller.commission_rate)::BIGINT;
  IF v_commission_cents <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Zero commission to deduct');
  END IF;

  -- Resolve client org for display
  SELECT o.id, o.name INTO v_client_org_id, v_client_name
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.user_id = v_subscription.user_id
  LIMIT 1;

  -- Calendar-month window for the refund timestamp
  v_period_start := date_trunc('month', p_refund_at)::DATE;
  v_period_end := (date_trunc('month', p_refund_at) + INTERVAL '1 month - 1 day')::DATE;

  -- Find an existing payout for that period
  SELECT id, status INTO v_payout
  FROM public.reseller_payouts
  WHERE reseller_id = v_reseller.id
    AND period_start = v_period_start
  LIMIT 1;

  -- If the matching payout is finalized, push the adjustment to current pending month instead
  IF v_payout.id IS NOT NULL AND v_payout.status IN ('paid', 'void') THEN
    v_period_start := date_trunc('month', now())::DATE;
    v_period_end := (date_trunc('month', now()) + INTERVAL '1 month - 1 day')::DATE;
    SELECT id, status INTO v_payout
    FROM public.reseller_payouts
    WHERE reseller_id = v_reseller.id
      AND period_start = v_period_start
    LIMIT 1;
  END IF;

  -- Create the pending payout shell if it doesn't exist yet
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

  -- Insert the negative adjustment line item
  INSERT INTO public.payout_line_items (
    payout_id, subscription_id, client_org_id, client_name,
    amount_cents, commission_cents, refund_transaction_id
  )
  VALUES (
    v_payout.id,
    v_subscription.id,
    v_client_org_id,
    COALESCE(v_client_name, 'Refunded client') || ' (refund)',
    -p_refund_amount_cents,
    -v_commission_cents,
    p_refund_transaction_id
  );

  -- Recalculate payout totals from line items (sum may now include negatives)
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
    'deducted_commission_cents', v_commission_cents,
    'period_start', v_period_start
  );
END;
$$;