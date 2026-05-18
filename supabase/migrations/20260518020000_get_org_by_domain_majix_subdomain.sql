-- Extend get_org_by_domain to resolve tenant <slug>.majix.ai subdomains.
--
-- Context: wrangler.jsonc binds `*.majix.ai/*` to the Worker. Tenants get
-- `<slug>.majix.ai` provisioned at signup (free white-label tier). Existing
-- definition (migration 20260427030638) only matched verified hostnames in
-- `org_custom_domains`, so Majix subdomains never themed.
--
-- New behaviour:
--   1) Verified custom hostname via `org_custom_domains` (unchanged shape).
--   2) `<label>.majix.ai` → treat `<label>` as the org slug. Reserved infra
--      subdomains (app, www, customers, notify, api, admin, mail) short-
--      circuit to NULL even if a tenant somehow claims that slug.
--   3) Majix subdomains return `verified = true` unconditionally — Majix
--      owns the parent zone + wildcard cert, nothing for tenant to verify.
--
-- Return type stays `json` and the field shape stays identical to the prior
-- definition so the `DomainBranding` interface in `DomainBrandingProvider`
-- keeps working without a regen. `LANGUAGE` flips sql → plpgsql to allow
-- the conditional second branch — CREATE OR REPLACE permits the change.
--
-- Anon EXECUTE is preserved via the lockdown migration
-- (20260517133315_lock_down_security_definer_funcs.sql) — `get_org_by_domain`
-- sits in the anon-allowed bucket.

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

  -- 2) Tenant Majix subdomain (<slug>.majix.ai).
  IF v_host ~ '^[a-z0-9][a-z0-9-]*\.majix\.ai$' THEN
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
