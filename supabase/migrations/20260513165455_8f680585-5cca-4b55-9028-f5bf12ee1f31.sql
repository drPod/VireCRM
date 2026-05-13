CREATE TABLE public.energy_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_name TEXT NOT NULL,
  agent_closed UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_closed_name TEXT,
  start_date DATE,
  end_date DATE,
  previous_supplier TEXT,
  current_supplier TEXT,
  service_address TEXT,
  esi_id TEXT,
  annual_kwh NUMERIC,
  term_kwh NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_energy_customers_org ON public.energy_customers(organization_id);

ALTER TABLE public.energy_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view energy customers"
  ON public.energy_customers FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org members create energy customers"
  ON public.energy_customers FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Update accessible energy customers"
  ON public.energy_customers FOR UPDATE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR has_role(auth.uid(), 'manager'::app_role, organization_id)
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
    )
  )
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners delete energy customers"
  ON public.energy_customers FOR DELETE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

CREATE POLICY "Service role manages energy customers"
  ON public.energy_customers
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_energy_customers_updated
  BEFORE UPDATE ON public.energy_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();