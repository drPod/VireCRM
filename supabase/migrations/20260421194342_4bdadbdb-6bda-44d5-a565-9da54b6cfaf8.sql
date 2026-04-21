-- Per-org integration credentials (e.g. Apollo.io API key for real lead discovery).
-- Kept separate from `organizations` so the key never accidentally leaks via
-- existing org SELECT policies.
CREATE TABLE public.org_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

ALTER TABLE public.org_integrations ENABLE ROW LEVEL SECURITY;

-- Owners only — managers/reps must NOT see the raw key.
CREATE POLICY "Owners view their org integrations"
ON public.org_integrations
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners insert their org integrations"
ON public.org_integrations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners update their org integrations"
ON public.org_integrations
FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role, organization_id))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners delete their org integrations"
ON public.org_integrations
FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role, organization_id));

-- Service role bypasses RLS implicitly, but add an explicit policy so
-- supabaseAdmin reads work the same way they do for other tables.
CREATE POLICY "Service role manages integrations"
ON public.org_integrations
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_org_integrations_updated_at
BEFORE UPDATE ON public.org_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_org_integrations_org_provider
ON public.org_integrations (organization_id, provider);