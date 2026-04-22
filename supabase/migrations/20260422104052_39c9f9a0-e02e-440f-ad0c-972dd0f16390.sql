CREATE TABLE public.outreach_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX outreach_templates_org_idx
  ON public.outreach_templates (organization_id, created_at DESC);

CREATE UNIQUE INDEX outreach_templates_one_default_per_org
  ON public.outreach_templates (organization_id)
  WHERE is_default = true;

ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view outreach templates"
  ON public.outreach_templates
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org owners/managers can insert outreach templates"
  ON public.outreach_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid()
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Org owners/managers can update outreach templates"
  ON public.outreach_templates
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid()
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Org owners/managers can delete outreach templates"
  ON public.outreach_templates
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid()
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE TRIGGER update_outreach_templates_updated_at
  BEFORE UPDATE ON public.outreach_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();