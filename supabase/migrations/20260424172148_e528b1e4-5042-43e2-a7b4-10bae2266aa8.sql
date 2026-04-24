ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS sidebar_color text,
  ADD COLUMN IF NOT EXISTS button_color text;

DROP FUNCTION IF EXISTS public.get_org_by_domain(text);
CREATE FUNCTION public.get_org_by_domain(p_hostname text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'verified', (o.domain_verified_at IS NOT NULL)
  )
  FROM public.organizations o
  WHERE lower(o.custom_domain) = lower(p_hostname)
    AND o.domain_verified_at IS NOT NULL
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.get_reseller_branding(text);
CREATE FUNCTION public.get_reseller_branding(p_slug text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'is_reseller', o.is_reseller
  )
  FROM public.organizations o
  WHERE o.slug = p_slug
    AND o.is_reseller = true
  LIMIT 1;
$$;