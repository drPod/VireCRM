-- Per-environment mapping from a customer email to its Stripe customer id
create table if not exists public.submission_stripe_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  environment text not null default 'sandbox',
  stripe_customer_id text not null,
  first_submission_id uuid references public.contact_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, environment)
);

create index if not exists idx_subm_stripe_customers_customer
  on public.submission_stripe_customers(stripe_customer_id);

alter table public.submission_stripe_customers enable row level security;

-- Service role manages the table; platform admins can read it.
create policy "Service role manages submission_stripe_customers"
  on public.submission_stripe_customers for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Platform admins can read submission_stripe_customers"
  on public.submission_stripe_customers for select
  to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Aggregated payment history for a submission, keyed by email + customer.
create or replace function public.admin_submission_payment_history(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_customer_ids text[];
  v_result jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'permission denied: platform admin required';
  end if;

  select email into v_email from public.contact_submissions where id = p_submission_id;
  if v_email is null then
    return jsonb_build_object('email', null, 'invoices', '[]'::jsonb, 'totals', jsonb_build_object());
  end if;

  select coalesce(array_agg(distinct stripe_customer_id), array[]::text[])
    into v_customer_ids
  from public.submission_stripe_customers
  where email = v_email;

  with invs as (
    select id, submission_id, customer_email, stripe_customer_id, stripe_invoice_id,
           hosted_invoice_url, invoice_pdf, number, description,
           amount_due_cents, amount_paid_cents, currency, status,
           created_at, paid_at, environment
    from public.platform_invoices
    where customer_email = v_email
       or (array_length(v_customer_ids, 1) > 0 and stripe_customer_id = any(v_customer_ids))
    order by created_at desc
  )
  select jsonb_build_object(
    'email', v_email,
    'stripe_customer_ids', to_jsonb(v_customer_ids),
    'invoices', coalesce((select jsonb_agg(row_to_json(invs)) from invs), '[]'::jsonb),
    'totals', jsonb_build_object(
      'invoices', (select count(*) from invs),
      'paid_count', (select count(*) from invs where status = 'paid'),
      'paid_cents', (select coalesce(sum(amount_paid_cents),0) from invs),
      'outstanding_cents', (select coalesce(sum(amount_due_cents - amount_paid_cents),0) from invs where status in ('open','sent'))
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_submission_payment_history(uuid) from public;
grant execute on function public.admin_submission_payment_history(uuid) to authenticated;