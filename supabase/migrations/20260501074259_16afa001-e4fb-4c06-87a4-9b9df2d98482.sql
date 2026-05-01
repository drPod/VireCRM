DROP FUNCTION IF EXISTS public.admin_list_organizations();

CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  industry_template text,
  plan text,
  is_reseller boolean,
  member_count bigint,
  lead_count bigint,
  created_at timestamp with time zone,
  owner_email text,
  subscription_status text,
  subscription_price_id text,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  RETURN QUERY
  WITH owner_user AS (
    SELECT DISTINCT ON (p.organization_id)
      p.organization_id,
      p.user_id
    FROM public.profiles p
    ORDER BY p.organization_id, p.created_at ASC
  ),
  latest_sub AS (
    SELECT DISTINCT ON (s.user_id)
      s.user_id,
      s.status,
      s.price_id,
      s.current_period_end,
      s.cancel_at_period_end
    FROM public.subscriptions s
    ORDER BY s.user_id, s.created_at DESC
  )
  SELECT
    o.id,
    o.name,
    o.slug,
    o.industry_template,
    o.plan,
    o.is_reseller,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.organization_id = o.id),
    (SELECT COUNT(*) FROM public.leads l WHERE l.organization_id = o.id),
    o.created_at,
    u.email::text AS owner_email,
    ls.status AS subscription_status,
    ls.price_id AS subscription_price_id,
    ls.current_period_end,
    ls.cancel_at_period_end
  FROM public.organizations o
  LEFT JOIN owner_user ou ON ou.organization_id = o.id
  LEFT JOIN auth.users u ON u.id = ou.user_id
  LEFT JOIN latest_sub ls ON ls.user_id = ou.user_id
  ORDER BY o.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_org_plan(
  p_org_id uuid,
  p_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  IF p_plan IS NULL OR length(trim(p_plan)) = 0 THEN
    RAISE EXCEPTION 'Plan label is required';
  END IF;

  SELECT plan INTO v_old FROM public.organizations WHERE id = p_org_id;
  IF v_old IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  UPDATE public.organizations
  SET plan = p_plan, updated_at = now()
  WHERE id = p_org_id;

  RETURN jsonb_build_object('success', true, 'old_plan', v_old, 'new_plan', p_plan);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_org_billing(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner record;
  v_subs jsonb;
  v_invoices jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  SELECT u.id AS user_id, u.email::text AS email
    INTO v_owner
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.organization_id = p_org_id
  ORDER BY p.created_at ASC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'price_id', s.price_id,
    'product_id', s.product_id,
    'current_period_start', s.current_period_start,
    'current_period_end', s.current_period_end,
    'cancel_at_period_end', s.cancel_at_period_end,
    'environment', s.environment,
    'created_at', s.created_at
  ) ORDER BY s.created_at DESC), '[]'::jsonb)
    INTO v_subs
  FROM public.subscriptions s
  WHERE v_owner.user_id IS NOT NULL AND s.user_id = v_owner.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'number', i.number,
    'status', i.status,
    'amount_due_cents', i.amount_due_cents,
    'amount_paid_cents', i.amount_paid_cents,
    'currency', i.currency,
    'hosted_invoice_url', i.hosted_invoice_url,
    'due_date', i.due_date,
    'paid_at', i.paid_at,
    'created_at', i.created_at
  ) ORDER BY i.created_at DESC), '[]'::jsonb)
    INTO v_invoices
  FROM public.platform_invoices i
  WHERE v_owner.email IS NOT NULL AND lower(i.customer_email) = lower(v_owner.email);

  RETURN jsonb_build_object(
    'owner', CASE WHEN v_owner.user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'user_id', v_owner.user_id,
      'email', v_owner.email
    ) END,
    'subscriptions', COALESCE(v_subs, '[]'::jsonb),
    'invoices', COALESCE(v_invoices, '[]'::jsonb)
  );
END;
$function$;