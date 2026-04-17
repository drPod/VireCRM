CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  trigger_type TEXT NOT NULL DEFAULT 'lead_created' CHECK (trigger_type IN ('lead_created', 'status_changed', 'message_received')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_org ON public.workflows(organization_id);
CREATE INDEX idx_workflows_org_status ON public.workflows(organization_id, status);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org workflows"
  ON public.workflows FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Managers and owners manage workflows"
  ON public.workflows FOR ALL
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'manager'::app_role, organization_id)
    )
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'manager'::app_role, organization_id)
    )
  );

CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();