
-- 1. Replace has_role with org-scoped version (3 params)
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role, p_org_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role
      AND (p_org_id IS NULL OR organization_id = p_org_id)
  )
$$;

-- 2. Guard RPCs so they only return data for the calling user
CREATE OR REPLACE FUNCTION public.get_user_org_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id = auth.uid() THEN (
      SELECT organization_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1
    )
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN user_uuid = auth.uid() THEN (
      SELECT EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = user_uuid
        AND environment = check_env
        AND status IN ('active', 'trialing')
        AND (current_period_end IS NULL OR current_period_end > now())
      )
    )
    ELSE NULL
  END
$$;

-- 3. Update RLS policies that use has_role to pass org_id

-- campaigns: drop and recreate
DROP POLICY IF EXISTS "Managers and owners can manage campaigns" ON public.campaigns;
CREATE POLICY "Managers and owners can manage campaigns"
  ON public.campaigns FOR ALL
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner', organization_id)
      OR has_role(auth.uid(), 'manager', organization_id)
    )
  );

-- tasks: drop and recreate
DROP POLICY IF EXISTS "Managers and owners can manage tasks" ON public.tasks;
CREATE POLICY "Managers and owners can manage tasks"
  ON public.tasks FOR ALL
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner', organization_id)
      OR has_role(auth.uid(), 'manager', organization_id)
    )
  );

-- user_roles: drop and recreate
DROP POLICY IF EXISTS "Owners can manage roles in their org" ON public.user_roles;
CREATE POLICY "Owners can manage roles in their org"
  ON public.user_roles FOR ALL
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'owner', organization_id)
  );

-- organizations update: drop and recreate with WITH CHECK preventing sensitive field changes
DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
CREATE POLICY "Owners can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    user_belongs_to_org(auth.uid(), id)
    AND has_role(auth.uid(), 'owner', id)
  )
  WITH CHECK (
    user_belongs_to_org(auth.uid(), id)
    AND has_role(auth.uid(), 'owner', id)
  );

-- 4. Revoke UPDATE on sensitive columns from authenticated and anon
REVOKE UPDATE (plan, ai_tokens_used, ai_tokens_limit) ON public.organizations FROM authenticated;
REVOKE UPDATE (plan, ai_tokens_used, ai_tokens_limit) ON public.organizations FROM anon;

-- 5. Create atomic increment function for AI tokens (service_role only)
CREATE OR REPLACE FUNCTION public.increment_ai_tokens(p_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.organizations
  SET ai_tokens_used = ai_tokens_used + 1
  WHERE id = p_org_id;
$$;

-- Only service_role can call this
REVOKE EXECUTE ON FUNCTION public.increment_ai_tokens(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_ai_tokens(uuid) FROM anon;
