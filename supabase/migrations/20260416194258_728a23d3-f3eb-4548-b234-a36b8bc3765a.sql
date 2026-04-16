-- Add payment_reference column to track wire/transfer/Stripe ID
ALTER TABLE public.reseller_payouts
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- RPC: reseller owner marks their own payout as paid (records receipt)
CREATE OR REPLACE FUNCTION public.mark_payout_paid(
  p_payout_id UUID,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reseller_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT reseller_id, status INTO v_reseller_id, v_status
  FROM public.reseller_payouts
  WHERE id = p_payout_id;

  IF v_reseller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  IF NOT public.has_role(v_user_id, 'owner'::app_role, v_reseller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  IF v_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout already marked as paid');
  END IF;

  IF v_status = 'void' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot mark a void payout as paid');
  END IF;

  UPDATE public.reseller_payouts
  SET status = 'paid',
      paid_at = now(),
      payment_reference = NULLIF(TRIM(p_payment_reference), ''),
      updated_at = now()
  WHERE id = p_payout_id;

  RETURN jsonb_build_object('success', true, 'paid_at', now());
END;
$$;

-- Allow reseller owners to UPDATE their own payouts via the RPC (SECURITY DEFINER bypasses RLS,
-- but adding a policy makes intent explicit and supports any future direct-update use cases)
CREATE POLICY "Reseller owners can update own payouts"
  ON public.reseller_payouts FOR UPDATE
  USING (has_role(auth.uid(), 'owner'::app_role, reseller_id))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role, reseller_id));