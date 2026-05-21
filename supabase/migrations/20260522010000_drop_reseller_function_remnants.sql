-- Drop reseller function remnants that survived 20260521000000..02.
-- handle_new_user + admin_financial_overview still referenced is_reseller on
-- organizations (column dropped); handle_lead_won + mark_earning_paid +
-- mark_payout_paid still referenced dropped commission_rules /
-- commission_earnings / reseller_payouts. Result: every Supabase Auth signup
-- and every lead INSERT was 500ing on prod.

-- 1) Lead-won + its trigger
DROP TRIGGER IF EXISTS trg_lead_won ON public.leads;
DROP FUNCTION IF EXISTS public.handle_lead_won();

-- 2) Reseller payout / earning fns (reference dropped tables)
DROP FUNCTION IF EXISTS public.mark_earning_paid(uuid, text);
DROP FUNCTION IF EXISTS public.mark_payout_paid(uuid, text);

-- 3) handle_new_user: strip is_reseller column + v_grant.is_reseller ref.
--    pending_subscription_grants.is_reseller dropped in 20260521000002, and
--    organizations.is_reseller dropped in 20260521000000. Body otherwise
--    unchanged from 20260519120000_handle_new_user_skip_guc.sql.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  user_name TEXT;
  v_grant public.pending_subscription_grants%ROWTYPE;
  v_feature_key TEXT;
BEGIN
  IF current_setting('app.skip_auto_provision', true) = 'on' THEN
    RETURN NEW;
  END IF;

  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  SELECT * INTO v_grant
  FROM public.pending_subscription_grants
  WHERE LOWER(email) = LOWER(NEW.email)
    AND consumed_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.organizations (
    name, slug, brand_name, plan, monthly_lead_quota
  )
  VALUES (
    user_name || '''s Organization',
    LOWER(REPLACE(user_name, ' ', '-')) || '-' || SUBSTRING(NEW.id::text, 1, 8),
    user_name || '''s CRM',
    COALESCE(v_grant.plan, 'starter'),
    COALESCE(v_grant.monthly_lead_quota, 25)
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (NEW.id, new_org_id, user_name);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  IF v_grant.id IS NOT NULL AND array_length(v_grant.feature_keys, 1) > 0 THEN
    FOREACH v_feature_key IN ARRAY v_grant.feature_keys LOOP
      INSERT INTO public.org_features (organization_id, feature_key, enabled, notes)
      VALUES (new_org_id, v_feature_key, true, COALESCE(v_grant.notes, 'Granted via pre-paid enterprise package'))
      ON CONFLICT (organization_id, feature_key) DO UPDATE
        SET enabled = true, updated_at = now();
    END LOOP;

    UPDATE public.pending_subscription_grants
    SET consumed_at = now(),
        consumed_user_id = NEW.id,
        consumed_org_id = new_org_id
    WHERE id = v_grant.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) admin_financial_overview: drop the org_stats.resellers count
--    (organizations.is_reseller no longer exists).
CREATE OR REPLACE FUNCTION public.admin_financial_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'permission denied: platform admin required';
  end if;

  with sub_stats as (
    select
      count(*)::int as total,
      count(*) filter (where status in ('active','trialing'))::int as active,
      count(*) filter (where status = 'trialing')::int as trialing,
      count(*) filter (where status = 'past_due')::int as past_due,
      count(*) filter (where status = 'canceled')::int as canceled,
      count(*) filter (where created_at >= date_trunc('month', now()))::int as new_this_month,
      count(*) filter (where cancel_at_period_end = true and status in ('active','trialing'))::int as ending_soon
    from public.subscriptions
  ),
  invoice_stats as (
    select
      count(*)::int as total,
      count(*) filter (where status = 'paid')::int as paid_count,
      count(*) filter (where status in ('open','sent'))::int as outstanding_count,
      count(*) filter (where status = 'void')::int as void_count,
      count(*) filter (where created_at >= date_trunc('month', now()))::int as new_this_month,
      coalesce(sum(amount_paid_cents), 0)::bigint as paid_cents_total,
      coalesce(sum(amount_paid_cents) filter (where paid_at >= date_trunc('month', now())), 0)::bigint as paid_cents_this_month,
      coalesce(sum(amount_due_cents - amount_paid_cents) filter (where status in ('open','sent')), 0)::bigint as outstanding_cents
    from public.platform_invoices
  ),
  org_stats as (
    select
      count(*)::int as total,
      count(*) filter (where created_at >= date_trunc('month', now()))::int as new_this_month,
      count(*) filter (where plan is not null and plan <> 'free')::int as paying
    from public.organizations
  ),
  user_stats as (
    select
      count(*)::int as total,
      count(*) filter (where created_at >= date_trunc('month', now()))::int as new_this_month
    from auth.users
  ),
  recent_invoices as (
    select jsonb_agg(row_to_json(t)) as items
    from (
      select id, customer_email, customer_name, amount_due_cents, amount_paid_cents,
             currency, status, number, hosted_invoice_url, created_at, paid_at
      from public.platform_invoices
      order by created_at desc
      limit 10
    ) t
  ),
  recent_subs as (
    select jsonb_agg(row_to_json(t)) as items
    from (
      select s.id, s.user_id, u.email, s.product_id, s.price_id, s.status,
             s.current_period_end, s.cancel_at_period_end, s.created_at, s.environment
      from public.subscriptions s
      left join auth.users u on u.id = s.user_id
      order by s.created_at desc
      limit 10
    ) t
  ),
  plan_breakdown as (
    select jsonb_object_agg(coalesce(plan,'unassigned'), cnt) as items
    from (
      select plan, count(*)::int as cnt
      from public.organizations
      group by plan
    ) p
  )
  select jsonb_build_object(
    'subscriptions', (select row_to_json(sub_stats) from sub_stats),
    'invoices',      (select row_to_json(invoice_stats) from invoice_stats),
    'organizations', (select row_to_json(org_stats) from org_stats),
    'users',         (select row_to_json(user_stats) from user_stats),
    'recent_invoices', coalesce((select items from recent_invoices), '[]'::jsonb),
    'recent_subscriptions', coalesce((select items from recent_subs), '[]'::jsonb),
    'plan_breakdown', coalesce((select items from plan_breakdown), '{}'::jsonb),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;
