-- Org-level entitlement: a user has access if THEY have an active subscription,
-- OR if any OWNER of their organization does. This lets invited members
-- (sales_rep / manager) ride on the inviter's plan without paying separately.
--
-- "Active" = environment in (live, sandbox, manual)
--          AND status in (active, trialing)
--          AND (current_period_end IS NULL OR current_period_end > now())
--
-- SECURITY DEFINER + scoped to caller's own org to avoid leaking other orgs.
CREATE OR REPLACE FUNCTION public.org_has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN false;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.user_roles ur ON ur.user_id = s.user_id
    WHERE ur.organization_id = v_org_id
      AND ur.role = 'owner'::app_role
      AND s.status IN ('active', 'trialing')
      AND s.environment IN ('live', 'sandbox', 'manual')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) TO authenticated;