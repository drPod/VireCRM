-- 1. Add parent/reseller columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reseller BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON public.organizations(parent_organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 2. RLS: reseller owners can view their child orgs
DROP POLICY IF EXISTS "Reseller owners can view child orgs" ON public.organizations;
CREATE POLICY "Reseller owners can view child orgs"
ON public.organizations
FOR SELECT
USING (
  parent_organization_id IS NOT NULL
  AND public.user_belongs_to_org(auth.uid(), parent_organization_id)
  AND public.has_role(auth.uid(), 'owner'::app_role, parent_organization_id)
);

-- 3. Public function: lookup reseller branding by slug (used on /r/:slug/signup before auth)
CREATE OR REPLACE FUNCTION public.get_reseller_branding(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'slug', slug,
    'brand_name', brand_name,
    'logo_url', logo_url,
    'primary_color', primary_color,
    'is_reseller', is_reseller
  )
  FROM public.organizations
  WHERE slug = p_slug AND is_reseller = true
  LIMIT 1
$$;

-- 4. Function: list reseller clients with stats
CREATE OR REPLACE FUNCTION public.get_reseller_clients(p_reseller_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  brand_name text,
  slug text,
  plan text,
  created_at timestamptz,
  member_count bigint,
  lead_count bigint,
  last_activity timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    ) AS last_activity
  FROM public.organizations o
  WHERE o.parent_organization_id = p_reseller_id
    AND public.has_role(auth.uid(), 'owner'::app_role, p_reseller_id)
  ORDER BY o.created_at DESC
$$;

-- 5. Function: signup under reseller — moves the just-signed-up user into a new child org
CREATE OR REPLACE FUNCTION public.signup_under_reseller(
  p_reseller_slug text,
  p_company_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reseller_id UUID;
  v_new_org_id UUID;
  v_old_org_id UUID;
  v_user_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_reseller_id
  FROM public.organizations
  WHERE slug = p_reseller_slug AND is_reseller = true
  LIMIT 1;

  IF v_reseller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reseller not found');
  END IF;

  SELECT full_name, organization_id
    INTO v_user_name, v_old_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Create new child org under the reseller
  INSERT INTO public.organizations (name, slug, brand_name, parent_organization_id, plan)
  VALUES (
    p_company_name,
    LOWER(REGEXP_REPLACE(p_company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8),
    p_company_name,
    v_reseller_id,
    'starter'
  )
  RETURNING id INTO v_new_org_id;

  -- Move user into the child org
  UPDATE public.profiles
  SET organization_id = v_new_org_id, updated_at = now()
  WHERE user_id = v_user_id;

  -- Replace roles — user is owner of their child org
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_new_org_id, 'owner');

  -- Cleanup orphaned auto-created org
  IF v_old_org_id IS NOT NULL AND v_old_org_id <> v_new_org_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE organization_id = v_old_org_id) THEN
      DELETE FROM public.organizations WHERE id = v_old_org_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_new_org_id,
    'reseller_id', v_reseller_id
  );
END;
$$;