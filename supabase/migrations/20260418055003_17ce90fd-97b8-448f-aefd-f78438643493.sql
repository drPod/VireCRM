ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS notes text;

DROP POLICY IF EXISTS "Reseller owners can update child orgs" ON public.organizations;
CREATE POLICY "Reseller owners can update child orgs"
ON public.organizations
FOR UPDATE
USING (
  parent_organization_id IS NOT NULL
  AND has_role(auth.uid(), 'owner'::app_role, parent_organization_id)
)
WITH CHECK (
  parent_organization_id IS NOT NULL
  AND has_role(auth.uid(), 'owner'::app_role, parent_organization_id)
);

DROP FUNCTION IF EXISTS public.get_reseller_clients(uuid);

CREATE OR REPLACE FUNCTION public.get_reseller_clients(p_reseller_id uuid)
 RETURNS TABLE(id uuid, name text, brand_name text, slug text, plan text, created_at timestamp with time zone, member_count bigint, lead_count bigint, last_activity timestamp with time zone, reseller_plan_name text, monthly_price_cents bigint, markup_cents bigint, currency text, subscription_status text, notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    o.id,
    o.name,
    o.brand_name,
    o.slug,
    o.plan,
    o.created_at,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.organization_id = o.id) AS member_count,
    (SELECT COUNT(*) FROM public.leads l WHERE l.organization_id = o.id) AS lead_count,
    GREATEST(
      o.updated_at,
      COALESCE((SELECT MAX(updated_at) FROM public.leads l WHERE l.organization_id = o.id), o.created_at)
    ) AS last_activity,
    rp.name AS reseller_plan_name,
    rp.monthly_price_cents,
    GREATEST(rp.monthly_price_cents - rp.base_cost_cents, 0) AS markup_cents,
    rp.currency,
    sub.status AS subscription_status,
    o.notes
  FROM public.organizations o
  LEFT JOIN LATERAL (
    SELECT s.reseller_plan_id, s.status
    FROM public.subscriptions s
    JOIN public.profiles pr ON pr.user_id = s.user_id
    WHERE pr.organization_id = o.id
      AND s.attributed_reseller_id = p_reseller_id
      AND s.reseller_plan_id IS NOT NULL
    ORDER BY
      CASE WHEN s.status IN ('active', 'trialing') THEN 0 ELSE 1 END,
      s.created_at DESC NULLS LAST
    LIMIT 1
  ) sub ON TRUE
  LEFT JOIN public.reseller_plans rp ON rp.id = sub.reseller_plan_id
  WHERE o.parent_organization_id = p_reseller_id
    AND public.has_role(auth.uid(), 'owner'::app_role, p_reseller_id)
  ORDER BY o.created_at DESC
$function$;