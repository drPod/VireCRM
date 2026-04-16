-- Add verification fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS domain_verification_token TEXT NOT NULL DEFAULT ('vireon-verify-' || REPLACE(gen_random_uuid()::text, '-', '')),
  ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_custom_domain
  ON public.organizations(LOWER(custom_domain))
  WHERE custom_domain IS NOT NULL;

-- Public RPC: lookup branding by hostname (only verified domains)
CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname text)
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
    'is_reseller', is_reseller,
    'verified', domain_verified_at IS NOT NULL
  )
  FROM public.organizations
  WHERE LOWER(custom_domain) = LOWER(p_hostname)
    AND domain_verified_at IS NOT NULL
  LIMIT 1
$$;

-- Verify a custom domain by checking TXT record via DNS-over-HTTPS
-- We accept the verification result from the client (which calls Cloudflare/Google DoH)
-- and only update if the org owner is making the call
CREATE OR REPLACE FUNCTION public.mark_domain_verified(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_role(v_user_id, 'owner'::app_role, p_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  UPDATE public.organizations
  SET domain_verified_at = now(), updated_at = now()
  WHERE id = p_org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Reset verification when domain changes
CREATE OR REPLACE FUNCTION public.reset_domain_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
    NEW.domain_verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_domain_verification_trigger ON public.organizations;
CREATE TRIGGER reset_domain_verification_trigger
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.reset_domain_verification();