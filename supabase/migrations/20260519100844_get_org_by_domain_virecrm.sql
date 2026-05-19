-- Extend get_org_by_domain to accept virecrm.com as a second parent zone
-- alongside majix.ai.
--
-- Context: rebrand Majix → VireCRM. Parallel cutover — both
-- `<slug>.majix.ai` and `<slug>.virecrm.com` must resolve to the same tenant
-- so the legacy hostname keeps working while DNS / cert provisioning lands
-- on virecrm.com.
--
-- Prior definition: 20260518020000_get_org_by_domain_majix_subdomain.sql
-- accepted only `<slug>.majix.ai` in path 2 (regex
-- `^[a-z0-9][a-z0-9-]*\.majix\.ai$`).
--
-- New behaviour:
--   1) Verified custom hostname via `org_custom_domains` — UNCHANGED.
--   2) `<label>.majix.ai` OR `<label>.virecrm.com` → treat `<label>` as the
--      org slug. Same reserved-label short-circuit list
--      (app, www, customers, notify, api, admin, mail) — neither parent
--      zone gets to claim those labels as tenant slugs.
--   3) Return shape, SECURITY DEFINER posture, anon EXECUTE grant
--      (from 20260517133315_lock_down_security_definer_funcs.sql), and
--      `verified=true` semantics for parent-zone subdomains: all unchanged.
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

  -- 2) Tenant parent-zone subdomain (<slug>.majix.ai OR <slug>.virecrm.com).
  IF v_host ~ '^[a-z0-9][a-z0-9-]*\.(majix\.ai|virecrm\.com)$' THEN
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
