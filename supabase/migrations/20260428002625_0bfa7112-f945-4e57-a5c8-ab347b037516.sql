ALTER TABLE public.credit_packs
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT;

CREATE OR REPLACE FUNCTION public.grant_credit_pack(
  p_org_id UUID,
  p_pack_key TEXT,
  p_credits INTEGER,
  p_purchased_by UUID DEFAULT NULL,
  p_amount_cents INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT 'usd',
  p_source TEXT DEFAULT 'checkout',
  p_stripe_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_receipt_url TEXT DEFAULT NULL,
  p_hosted_invoice_url TEXT DEFAULT NULL
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

  -- Idempotency: if we already inserted this stripe session, backfill receipt fields if missing.
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT id INTO v_pack_id FROM public.credit_packs WHERE stripe_session_id = p_stripe_session_id;
    IF v_pack_id IS NOT NULL THEN
      UPDATE public.credit_packs
        SET receipt_url = COALESCE(receipt_url, p_receipt_url),
            hosted_invoice_url = COALESCE(hosted_invoice_url, p_hosted_invoice_url),
            updated_at = now()
        WHERE id = v_pack_id;
      RETURN jsonb_build_object('ok', true, 'pack_id', v_pack_id, 'duplicate', true);
    END IF;
  END IF;

  INSERT INTO public.credit_packs (
    organization_id, purchased_by, pack_key,
    credits_total, credits_remaining,
    amount_cents, currency, source,
    stripe_session_id, stripe_payment_intent_id,
    receipt_url, hosted_invoice_url
  ) VALUES (
    p_org_id, p_purchased_by, p_pack_key,
    p_credits, p_credits,
    p_amount_cents, COALESCE(p_currency, 'usd'), COALESCE(p_source, 'checkout'),
    p_stripe_session_id, p_stripe_payment_intent_id,
    p_receipt_url, p_hosted_invoice_url
  ) RETURNING id INTO v_pack_id;

  INSERT INTO public.credit_usage_log (
    organization_id, user_id, action, command_id, lead_id,
    credits_charged, credits_before, credits_after, quota,
    unlimited, status, metadata
  ) VALUES (
    p_org_id, p_purchased_by, 'credit_pack_granted',
    p_stripe_session_id, NULL,
    -p_credits, NULL, NULL, NULL,
    false, 'consumed',
    jsonb_build_object(
      'pack_id', v_pack_id,
      'pack_key', p_pack_key,
      'source', p_source,
      'amount_cents', p_amount_cents,
      'receipt_url', p_receipt_url
    )
  );

  RETURN jsonb_build_object('ok', true, 'pack_id', v_pack_id);
END;
$$;