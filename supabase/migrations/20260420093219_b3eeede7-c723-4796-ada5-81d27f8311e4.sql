-- Add per-organization support email so white-label resellers can route
-- error reports / support requests to their own inbox instead of vireonx.space.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS support_email TEXT;

-- Expose support_email through the public domain branding RPC so the error
-- boundary (which runs before auth context is loaded on custom domains) can
-- read it without elevated permissions.
CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM public.organizations
  WHERE LOWER(custom_domain) = LOWER(p_hostname)
    AND domain_verified_at IS NOT NULL
  LIMIT 1
$function$;

-- Also expose it on the reseller-slug branding RPC for consistency
-- (used by /r/:resellerSlug signup pages).
CREATE OR REPLACE FUNCTION public.get_reseller_branding(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', id,
    'slug', slug,
    'brand_name', brand_name,
    'logo_url', logo_url,
    'primary_color', primary_color,
    'is_reseller', is_reseller,
    'support_email', support_email
  )
  FROM public.organizations
  WHERE slug = p_slug AND is_reseller = true
  LIMIT 1
$function$;