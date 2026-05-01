create or replace function public.admin_financial_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      count(*) filter (where is_reseller = true)::int as resellers,
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

revoke all on function public.admin_financial_overview() from public;
grant execute on function public.admin_financial_overview() to authenticated;