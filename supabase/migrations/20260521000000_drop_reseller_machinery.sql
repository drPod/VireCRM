-- Drop reseller RPC functions first (they reference tables being dropped below)
DROP FUNCTION IF EXISTS public.get_reseller_branding(text);
DROP FUNCTION IF EXISTS public.list_reseller_plans_public(text);
DROP FUNCTION IF EXISTS public.get_reseller_plan_public(text, text);
DROP FUNCTION IF EXISTS public.signup_under_reseller(text, text);
DROP FUNCTION IF EXISTS public.calculate_reseller_payouts(date, date);

-- Drop reseller-only tables (CASCADE drops dependent FKs and constraints)
DROP TABLE IF EXISTS public.commission_earnings CASCADE;
DROP TABLE IF EXISTS public.commission_rules CASCADE;
DROP TABLE IF EXISTS public.reseller_payouts CASCADE;
DROP TABLE IF EXISTS public.reseller_plans CASCADE;

-- Drop RLS policies that reference columns being dropped (CASCADE won't cover these)
DROP POLICY IF EXISTS "Reseller owners can view child orgs" ON public.organizations;
DROP POLICY IF EXISTS "Reseller owners can update child orgs" ON public.organizations;
DROP POLICY IF EXISTS "Reseller owners view attributed subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Reseller owners view attributed transactions" ON public.transactions;

-- Remove reseller columns from shared tables
ALTER TABLE public.organizations DROP COLUMN IF EXISTS is_reseller;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS attributed_reseller_id;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS reseller_plan_id;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS reseller_plan_id;

-- Recreate get_org_by_domain without the now-dropped is_reseller column.
-- Prior definition: 20260520110000_get_org_by_domain_virecrm_only.sql
-- Behaviour is identical except the JSON output no longer includes is_reseller.
CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname TEXT)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host text := LOWER(p_hostname);
  v_slug text;
  v_result json;
BEGIN
  -- 1) Verified custom hostname (e.g. crm.acmecorp.com).
  SELECT json_build_object(
    'id', o.id,
    'slug', o.slug,
    'brand_name', o.brand_name,
    'logo_url', o.logo_url,
    'favicon_url', o.favicon_url,
    'font_family', o.font_family,
    'primary_color', o.primary_color,
    'secondary_color', o.secondary_color,
    'accent_color', o.accent_color,
    'sidebar_color', o.sidebar_color,
    'button_color', o.button_color,
    'support_email', o.support_email,
    'verified', true
  )
  INTO v_result
  FROM public.org_custom_domains d
  JOIN public.organizations o ON o.id = d.organization_id
  WHERE LOWER(d.hostname) = v_host
    AND d.verified_at IS NOT NULL
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 2) Tenant virecrm.com subdomain (<slug>.virecrm.com).
  --    majix.ai requests 308-redirect at the Worker and never reach here.
  IF v_host ~ '^[a-z0-9][a-z0-9-]*\.virecrm\.com$' THEN
    v_slug := split_part(v_host, '.', 1);
    IF v_slug NOT IN ('app', 'www', 'customers', 'notify', 'api', 'admin', 'mail') THEN
      SELECT json_build_object(
        'id', o.id,
        'slug', o.slug,
        'brand_name', o.brand_name,
        'logo_url', o.logo_url,
        'favicon_url', o.favicon_url,
        'font_family', o.font_family,
        'primary_color', o.primary_color,
        'secondary_color', o.secondary_color,
        'accent_color', o.accent_color,
        'sidebar_color', o.sidebar_color,
        'button_color', o.button_color,
        'support_email', o.support_email,
        'verified', true
      )
      INTO v_result
      FROM public.organizations o
      WHERE o.slug = v_slug
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- Restore anon EXECUTE grant (SECURITY DEFINER + CREATE OR REPLACE resets grants).
GRANT EXECUTE ON FUNCTION public.get_org_by_domain(text) TO anon;
