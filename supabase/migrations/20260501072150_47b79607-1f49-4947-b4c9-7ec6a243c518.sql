-- 1. Platform admins table (separate from per-org user_roles)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 2. Recursion-safe helper. SECURITY DEFINER so policies on other tables can
--    call it without needing direct SELECT on platform_admins.
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated, service_role;

-- 3. RLS on platform_admins itself: only platform admins can see/manage the list.
DROP POLICY IF EXISTS "Platform admins can view admin list" ON public.platform_admins;
CREATE POLICY "Platform admins can view admin list"
  ON public.platform_admins FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage admin list" ON public.platform_admins;
CREATE POLICY "Platform admins can manage admin list"
  ON public.platform_admins FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 4. Platform-admin bypass policies on the key tables.
--    These are ADDITIVE — existing per-org policies still apply for normal users.

-- organizations
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
CREATE POLICY "Platform admins can view all organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can update all organizations" ON public.organizations;
CREATE POLICY "Platform admins can update all organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can insert organizations" ON public.organizations;
CREATE POLICY "Platform admins can insert organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
CREATE POLICY "Platform admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Platform admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Platform admins can view all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can manage all user_roles" ON public.user_roles;
CREATE POLICY "Platform admins can manage all user_roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- org_features
DROP POLICY IF EXISTS "Platform admins can view all org_features" ON public.org_features;
CREATE POLICY "Platform admins can view all org_features"
  ON public.org_features FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can manage all org_features" ON public.org_features;
CREATE POLICY "Platform admins can manage all org_features"
  ON public.org_features FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- contact_submissions (host needs to see all inquiries)
DROP POLICY IF EXISTS "Platform admins can view all contact_submissions" ON public.contact_submissions;
CREATE POLICY "Platform admins can view all contact_submissions"
  ON public.contact_submissions FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 5. Seed Ethan as the founding platform admin.
INSERT INTO public.platform_admins (user_id, notes)
SELECT u.id, 'Founding platform admin (host)'
FROM auth.users u
WHERE lower(u.email) = 'ethansereti@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 6. RPC: assign an industry template to any organization (platform-admin only).
--    Goes through an RPC instead of a raw UPDATE so we can audit and validate.
CREATE OR REPLACE FUNCTION public.admin_set_org_industry(
  p_org_id UUID,
  p_industry TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL OR NOT public.is_platform_admin(v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Platform admin required');
  END IF;

  IF p_industry NOT IN ('general', 'gym', 'solar', 'energy', 'real_estate', 'insurance') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unknown industry template');
  END IF;

  UPDATE public.organizations
  SET industry_template = p_industry,
      enabled_modules = NULL,  -- existing trigger resyncs to defaults for the new industry
      updated_at = now()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_org_industry(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_org_industry(UUID, TEXT) TO authenticated;

-- 7. RPC: list every organization with summary stats (platform-admin only).
CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  industry_template TEXT,
  plan TEXT,
  is_reseller BOOLEAN,
  member_count BIGINT,
  lead_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.industry_template,
    o.plan,
    o.is_reseller,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.organization_id = o.id),
    (SELECT COUNT(*) FROM public.leads l WHERE l.organization_id = o.id),
    o.created_at
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_organizations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_organizations() TO authenticated;