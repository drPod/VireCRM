ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS font_family TEXT,
  ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- Refresh the public RPCs so the storefront/landing page can read these fields
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
    'favicon_url', favicon_url,
    'font_family', font_family,
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
    'favicon_url', favicon_url,
    'font_family', font_family,
    'primary_color', primary_color,
    'is_reseller', is_reseller,
    'support_email', support_email
  )
  FROM public.organizations
  WHERE slug = p_slug AND is_reseller = true
  LIMIT 1
$function$;