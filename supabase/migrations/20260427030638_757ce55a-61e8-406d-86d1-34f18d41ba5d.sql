-- =========================================================================
-- Multi-hostname custom domains
-- =========================================================================

CREATE TABLE public.org_custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  verified_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hostnames are globally unique (case-insensitive) — two orgs can't claim the same host.
CREATE UNIQUE INDEX org_custom_domains_hostname_lower_key
  ON public.org_custom_domains (lower(hostname));

-- At most one primary per org
CREATE UNIQUE INDEX org_custom_domains_one_primary_per_org
  ON public.org_custom_domains (organization_id)
  WHERE is_primary = true;

CREATE INDEX org_custom_domains_org_id_idx ON public.org_custom_domains (organization_id);

CREATE TRIGGER org_custom_domains_updated_at
  BEFORE UPDATE ON public.org_custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reset verified_at automatically when hostname changes
CREATE OR REPLACE FUNCTION public.reset_org_custom_domain_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.hostname) IS DISTINCT FROM lower(OLD.hostname) THEN
    NEW.verified_at := NULL;
    NEW.verification_token := encode(gen_random_bytes(18), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reset_org_custom_domain_verification_trg
  BEFORE UPDATE OF hostname ON public.org_custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.reset_org_custom_domain_verification();

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE public.org_custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org's custom domains"
ON public.org_custom_domains
FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can insert custom domains for their org"
ON public.org_custom_domains
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners can update custom domains for their org"
ON public.org_custom_domains
FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners can delete custom domains for their org"
ON public.org_custom_domains
FOR DELETE
USING (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

-- =========================================================================
-- Backfill existing single-domain rows
-- =========================================================================
INSERT INTO public.org_custom_domains (organization_id, hostname, is_primary, verification_token, verified_at)
SELECT
  o.id,
  lower(o.custom_domain),
  true,
  o.domain_verification_token,
  o.domain_verified_at
FROM public.organizations o
WHERE o.custom_domain IS NOT NULL AND length(trim(o.custom_domain)) > 0
ON CONFLICT DO NOTHING;

-- =========================================================================
-- Public hostname lookup — resolves ANY verified hostname (primary or alias)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname TEXT)
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
    'verified', true
  )
  FROM public.org_custom_domains d
  JOIN public.organizations o ON o.id = d.organization_id
  WHERE lower(d.hostname) = lower(p_hostname)
    AND d.verified_at IS NOT NULL
  LIMIT 1;
$$;

-- =========================================================================
-- RPCs
-- =========================================================================

-- Add a hostname (gated by custom_domain feature flag for non-service-role)
CREATE OR REPLACE FUNCTION public.add_custom_domain(p_org_id UUID, p_hostname TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_clean TEXT;
  v_make_primary BOOLEAN := false;
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role, p_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  IF NOT public.has_feature(p_org_id, 'custom_domain') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Custom domains require the Enterprise White-Label add-on');
  END IF;

  v_clean := lower(trim(p_hostname));
  IF v_clean IS NULL OR v_clean = '' OR v_clean !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid hostname format');
  END IF;

  -- Already taken globally?
  IF EXISTS (SELECT 1 FROM public.org_custom_domains WHERE lower(hostname) = v_clean) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hostname is already registered');
  END IF;

  -- First hostname for the org becomes primary automatically.
  IF NOT EXISTS (SELECT 1 FROM public.org_custom_domains WHERE organization_id = p_org_id) THEN
    v_make_primary := true;
  END IF;

  INSERT INTO public.org_custom_domains (organization_id, hostname, is_primary, created_by)
  VALUES (p_org_id, v_clean, v_make_primary, v_user)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'hostname', v_clean, 'is_primary', v_make_primary);
END;
$$;

-- Remove a hostname
CREATE OR REPLACE FUNCTION public.remove_custom_domain(p_domain_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org UUID;
  v_was_primary BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT organization_id, is_primary INTO v_org, v_was_primary
  FROM public.org_custom_domains WHERE id = p_domain_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hostname not found');
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role, v_org) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  DELETE FROM public.org_custom_domains WHERE id = p_domain_id;

  -- If we removed the primary, promote the most recently verified remaining
  -- hostname to primary (or the most recent overall if none verified).
  IF v_was_primary THEN
    UPDATE public.org_custom_domains
    SET is_primary = true
    WHERE id = (
      SELECT id FROM public.org_custom_domains
      WHERE organization_id = v_org
      ORDER BY (verified_at IS NULL), verified_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Set primary
CREATE OR REPLACE FUNCTION public.set_primary_custom_domain(p_domain_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org UUID;
  v_verified TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT organization_id, verified_at INTO v_org, v_verified
  FROM public.org_custom_domains WHERE id = p_domain_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hostname not found');
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role, v_org) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  IF v_verified IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verify the hostname before making it primary');
  END IF;

  -- Demote current primary first to satisfy partial unique index
  UPDATE public.org_custom_domains SET is_primary = false
  WHERE organization_id = v_org AND is_primary = true;

  UPDATE public.org_custom_domains SET is_primary = true
  WHERE id = p_domain_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Mark a specific hostname verified (called by the client after DNS check passes)
CREATE OR REPLACE FUNCTION public.mark_custom_domain_verified(p_domain_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT organization_id INTO v_org
  FROM public.org_custom_domains WHERE id = p_domain_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hostname not found');
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role, v_org) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner role required');
  END IF;

  UPDATE public.org_custom_domains
  SET verified_at = now(), updated_at = now()
  WHERE id = p_domain_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
