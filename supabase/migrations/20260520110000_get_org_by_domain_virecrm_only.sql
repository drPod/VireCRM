-- Drop majix.ai branch from get_org_by_domain.
--
-- All majix.ai requests now 308-redirect at the Worker before reaching this
-- function, making the `<slug>.majix.ai` subdomain match dead code.
-- Remove it so the function only accepts `<slug>.virecrm.com` in path 2.
--
-- Prior definition: 20260519100844_get_org_by_domain_virecrm.sql
--   accepted `(majix\.ai|virecrm\.com)` in the subdomain regex.
--
-- New behaviour:
--   1) Verified custom hostname via `org_custom_domains` — UNCHANGED.
--   2) `<label>.virecrm.com` → treat `<label>` as the org slug.
--      Reserved labels (app, www, customers, notify, api, admin, mail)
--      still short-circuit — UNCHANGED.
--   3) Return shape, SECURITY DEFINER posture, anon EXECUTE grant,
--      and `verified=true` semantics: all UNCHANGED.
--
-- CREATE OR REPLACE keeps this idempotent and preserves grants.

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
    'is_reseller', o.is_reseller,
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
        'is_reseller', o.is_reseller,
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
