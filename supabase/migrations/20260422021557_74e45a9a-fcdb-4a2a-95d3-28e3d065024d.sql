-- =====================================================
-- Connector integrations: which providers each org has enabled
-- =====================================================
CREATE TABLE IF NOT EXISTS public.org_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_org_connectors_org ON public.org_connectors(organization_id);

ALTER TABLE public.org_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their org's connectors"
ON public.org_connectors FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners can insert connectors for their org"
ON public.org_connectors FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners can update connectors for their org"
ON public.org_connectors FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role, organization_id))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners can delete connectors for their org"
ON public.org_connectors FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE TRIGGER trg_org_connectors_updated_at
BEFORE UPDATE ON public.org_connectors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Connector activity log: outbound + inbound events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.connector_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  provider text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  action text NOT NULL,                 -- e.g. 'send_message', 'sync_contacts'
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
  summary text,                          -- e.g. "Sent to #sales (3 chars)"
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- counts, ids, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_log_org ON public.connector_activity_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connector_log_lead ON public.connector_activity_log(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE public.connector_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view connector activity"
ON public.connector_activity_log FOR SELECT TO authenticated
USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Inserts only via service role (server functions).
