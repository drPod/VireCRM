-- Per-organization feature flag table for selling custom/enterprise features
CREATE TABLE public.org_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  enabled_by UUID,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, feature_key)
);

CREATE INDEX idx_org_features_org ON public.org_features(organization_id);
CREATE INDEX idx_org_features_key ON public.org_features(feature_key) WHERE enabled = true;

ALTER TABLE public.org_features ENABLE ROW LEVEL SECURITY;

-- Org members can see what features their org has
CREATE POLICY "Members can view their org features"
ON public.org_features
FOR SELECT
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Only service role (platform admin) can write — prevents owners from self-granting
CREATE POLICY "Service role manages features"
ON public.org_features
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Helper: check if an org has a feature enabled (and not expired)
CREATE OR REPLACE FUNCTION public.has_feature(p_org_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_features
    WHERE organization_id = p_org_id
      AND feature_key = p_feature_key
      AND enabled = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Auto-update timestamps
CREATE TRIGGER trg_org_features_updated_at
BEFORE UPDATE ON public.org_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();