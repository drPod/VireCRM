-- Extend get_org_by_domain to resolve tenant <slug>.majix.ai subdomains.
--
-- Context: wrangler.jsonc binds `*.majix.ai/*` to the Worker. Tenants get
-- `<slug>.majix.ai` provisioned at signup (free white-label tier). Existing
-- definition only matched `organizations.custom_domain` (verified custom
-- hostnames like `crm.acmecorp.com`), so tenant subdomains never themed.
--
-- New behaviour:
--   1) Try direct custom_domain match (unchanged for already-verified
--      customer hostnames via CF for SaaS).
--   2) If the input matches `<label>.majix.ai`, treat `<label>` as the org
--      slug. Reserved infra subdomains (app, www, customers, notify, api,
--      admin, mail) short-circuit to NULL — never themed as tenants.
--   3) Majix subdomains return `verified = true` unconditionally — we own
--      the parent zone + wildcard cert, so there's nothing for the tenant
--      to verify. (custom_domain verification still gates path 1.)
--
-- Anon EXECUTE is preserved via the lockdown migration
-- (20260517133315_lock_down_security_definer_funcs.sql).

CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host text := LOWER(p_hostname);
  v_slug text;
  v_result jsonb;
BEGIN
  -- 1) Direct verified custom-domain match (e.g. crm.acmecorp.com).
  SELECT jsonb_build_object(
    'id', id,
    'slug', slug,
    'brand_name', brand_name,
    'logo_url', logo_url,
    'primary_color', primary_color,
    'is_reseller', is_reseller,
    'support_email', support_email,
    'verified', domain_verified_at IS NOT NULL
  )
  INTO v_result
  FROM public.organizations
  WHERE LOWER(custom_domain) = v_host
    AND domain_verified_at IS NOT NULL
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 2) Tenant Majix subdomain (<slug>.majix.ai).
  IF v_host ~ '^[a-z0-9][a-z0-9-]*\.majix\.ai$' THEN
    v_slug := split_part(v_host, '.', 1);
    IF v_slug NOT IN ('app', 'www', 'customers', 'notify', 'api', 'admin', 'mail') THEN
      SELECT jsonb_build_object(
        'id', id,
        'slug', slug,
        'brand_name', brand_name,
        'logo_url', logo_url,
        'primary_color', primary_color,
        'is_reseller', is_reseller,
        'support_email', support_email,
        'verified', true
      )
      INTO v_result
      FROM public.organizations
      WHERE slug = v_slug
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_result;
END;
$function$;
