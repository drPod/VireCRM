-- Drop reseller client function
DROP FUNCTION IF EXISTS public.get_reseller_clients(uuid);

-- Drop pending_welcome_emails — created only by create-client-account (reseller
-- client onboarding); reseller clients no longer exist.
DROP TABLE IF EXISTS public.pending_welcome_emails;

-- Drop transactions.attributed_reseller_id — missed in first migration (only
-- subscriptions version was dropped).
ALTER TABLE public.transactions DROP COLUMN IF EXISTS attributed_reseller_id;

-- Drop pending_subscription_grants.is_reseller flag — grants no longer mark reseller accounts.
ALTER TABLE public.pending_subscription_grants DROP COLUMN IF EXISTS is_reseller;

-- Recreate admin_list_organizations without is_reseller (column dropped in 20260521000000).
DROP FUNCTION IF EXISTS public.admin_list_organizations();

CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  industry_template text,
  plan text,
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
