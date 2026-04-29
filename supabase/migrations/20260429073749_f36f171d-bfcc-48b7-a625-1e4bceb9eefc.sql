-- ============================================================
-- 1. Organization-level template + onboarding fields
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS industry_template TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS strict_lead_isolation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_industry_template_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_industry_template_check
  CHECK (industry_template IN ('general','energy','gym','solar','real_estate','insurance'));

-- ============================================================
-- 2. Lead RLS — owner-configurable strict isolation
-- ============================================================
DROP POLICY IF EXISTS "View accessible leads" ON public.leads;
CREATE POLICY "View accessible leads" ON public.leads
FOR SELECT USING (
  deleted_at IS NULL
  AND organization_id = get_user_org_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role, organization_id)
    OR has_role(auth.uid(), 'manager'::app_role, organization_id)
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM lead_shares ls
      WHERE ls.lead_id = leads.id AND ls.shared_with_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Update accessible leads" ON public.leads;
CREATE POLICY "Update accessible leads" ON public.leads
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role, organization_id)
    OR has_role(auth.uid(), 'manager'::app_role, organization_id)
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM lead_shares ls
      WHERE ls.lead_id = leads.id AND ls.shared_with_user_id = auth.uid()
    )
  )
) WITH CHECK (organization_id = get_user_org_id(auth.uid()));

-- ============================================================
-- 3. Helper: shared updated_at trigger function (idempotent)
-- ============================================================
-- (update_updated_at_column already exists in this project)

-- ============================================================
-- 4. Energy suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.energy_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  submission_email TEXT,
  markets_served TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  utilities_served TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  margin_cap_mils NUMERIC,
  commission_type TEXT NOT NULL DEFAULT 'upfront',
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_energy_suppliers_org ON public.energy_suppliers(organization_id);
ALTER TABLE public.energy_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view suppliers" ON public.energy_suppliers
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage suppliers" ON public.energy_suppliers
FOR ALL USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id))
) WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id))
);
CREATE POLICY "Service role manages suppliers" ON public.energy_suppliers
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_energy_suppliers_updated
BEFORE UPDATE ON public.energy_suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. LOA requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  document_url TEXT,
  customer_legal_name TEXT,
  service_address TEXT,
  esi_id TEXT,
  utility TEXT,
  notes TEXT,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loa_requests_org ON public.loa_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_loa_requests_lead ON public.loa_requests(lead_id);
ALTER TABLE public.loa_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view loa" ON public.loa_requests
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members create loa" ON public.loa_requests
FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Update accessible loa" ON public.loa_requests
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id)
       OR created_by = auth.uid()
       OR assigned_to = auth.uid())
) WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners delete loa" ON public.loa_requests
FOR DELETE USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(),'owner'::app_role,organization_id)
);
CREATE POLICY "Service role manages loa" ON public.loa_requests
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_loa_requests_updated BEFORE UPDATE ON public.loa_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. Usage requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID,
  loa_request_id UUID REFERENCES public.loa_requests(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  utility TEXT,
  esi_id TEXT,
  service_address TEXT,
  annual_kwh_estimate BIGINT,
  urgency TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  usage_file_url TEXT,
  bill_file_url TEXT,
  submitted_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_requests_org ON public.usage_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_requests_lead ON public.usage_requests(lead_id);
ALTER TABLE public.usage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view usage" ON public.usage_requests
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members create usage" ON public.usage_requests
FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Update accessible usage" ON public.usage_requests
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id)
       OR created_by = auth.uid()
       OR assigned_to = auth.uid())
) WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners delete usage" ON public.usage_requests
FOR DELETE USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(),'owner'::app_role,organization_id)
);
CREATE POLICY "Service role manages usage" ON public.usage_requests
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_usage_requests_updated BEFORE UPDATE ON public.usage_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. Pricing requests + supplier quotes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID,
  usage_request_id UUID REFERENCES public.usage_requests(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  utility TEXT,
  zone TEXT,
  start_date DATE,
  term_months_options INTEGER[] NOT NULL DEFAULT ARRAY[12,24,36],
  target_rate NUMERIC,
  consultant_mils NUMERIC,
  internal_mils NUMERIC,
  green_energy BOOLEAN NOT NULL DEFAULT false,
  nodal_pass_through BOOLEAN NOT NULL DEFAULT false,
  urgency TEXT NOT NULL DEFAULT 'normal',
  supplier_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  notes TEXT,
  selected_quote_id UUID,
  submitted_at TIMESTAMPTZ,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_requests_org ON public.pricing_requests(organization_id);
ALTER TABLE public.pricing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view pricing" ON public.pricing_requests
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members create pricing" ON public.pricing_requests
FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Update accessible pricing" ON public.pricing_requests
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id)
       OR created_by = auth.uid()
       OR assigned_to = auth.uid())
) WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners delete pricing" ON public.pricing_requests
FOR DELETE USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(),'owner'::app_role,organization_id)
);
CREATE POLICY "Service role manages pricing" ON public.pricing_requests
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_pricing_requests_updated BEFORE UPDATE ON public.pricing_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pricing_request_id UUID NOT NULL REFERENCES public.pricing_requests(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.energy_suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  term_months INTEGER NOT NULL,
  rate NUMERIC NOT NULL,
  energy_rate NUMERIC,
  tdsp_included BOOLEAN NOT NULL DEFAULT true,
  nodal_included BOOLEAN NOT NULL DEFAULT true,
  pass_throughs TEXT,
  margin_cap_mils NUMERIC,
  commission_structure TEXT,
  expires_at TIMESTAMPTZ,
  special_terms TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_pricing ON public.supplier_quotes(pricing_request_id);
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view quotes" ON public.supplier_quotes
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members manage quotes" ON public.supplier_quotes
FOR ALL USING (organization_id = get_user_org_id(auth.uid()))
WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role manages quotes" ON public.supplier_quotes
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_supplier_quotes_updated BEFORE UPDATE ON public.supplier_quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. Contract requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID,
  pricing_request_id UUID REFERENCES public.pricing_requests(id) ON DELETE SET NULL,
  selected_quote_id UUID REFERENCES public.supplier_quotes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  customer_legal_name TEXT,
  service_address TEXT,
  billing_address TEXT,
  esi_id TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  final_rate NUMERIC,
  term_months INTEGER,
  supplier_id UUID REFERENCES public.energy_suppliers(id) ON DELETE SET NULL,
  start_date DATE,
  agent_mils NUMERIC,
  contract_url TEXT,
  signed_url TEXT,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_requests_org ON public.contract_requests(organization_id);
ALTER TABLE public.contract_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view contracts" ON public.contract_requests
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members create contracts" ON public.contract_requests
FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Update accessible contracts" ON public.contract_requests
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id)
       OR created_by = auth.uid()
       OR assigned_to = auth.uid())
) WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners delete contracts" ON public.contract_requests
FOR DELETE USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(),'owner'::app_role,organization_id)
);
CREATE POLICY "Service role manages contracts" ON public.contract_requests
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_contract_requests_updated BEFORE UPDATE ON public.contract_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. Renewals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID,
  contract_request_id UUID REFERENCES public.contract_requests(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  current_supplier TEXT,
  current_rate NUMERIC,
  contract_end_date DATE,
  renewal_window_start DATE,
  customer_contacted_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  notes TEXT,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_renewals_org ON public.renewals(organization_id);
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view renewals" ON public.renewals
FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members create renewals" ON public.renewals
FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Update accessible renewals" ON public.renewals
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(),'owner'::app_role,organization_id)
       OR has_role(auth.uid(),'manager'::app_role,organization_id)
       OR created_by = auth.uid()
       OR assigned_to = auth.uid())
) WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners delete renewals" ON public.renewals
FOR DELETE USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(),'owner'::app_role,organization_id)
);
CREATE POLICY "Service role manages renewals" ON public.renewals
FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE TRIGGER trg_renewals_updated BEFORE UPDATE ON public.renewals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();