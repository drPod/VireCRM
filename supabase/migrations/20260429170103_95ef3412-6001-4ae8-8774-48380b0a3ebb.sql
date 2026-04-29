
-- Solar projects
CREATE TABLE public.solar_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_id UUID,
  homeowner_name TEXT NOT NULL,
  property_address TEXT,
  utility_company TEXT,
  system_size_kw NUMERIC,
  estimated_savings NUMERIC,
  status TEXT NOT NULL DEFAULT 'site_survey',
  install_date DATE,
  pto_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solar_projects ENABLE ROW LEVEL SECURITY;

-- Real estate listings
CREATE TABLE public.real_estate_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  address TEXT NOT NULL,
  mls_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  list_price NUMERIC,
  bedrooms INT,
  bathrooms NUMERIC,
  square_feet INT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.real_estate_listings ENABLE ROW LEVEL SECURITY;

-- Real estate showings
CREATE TABLE public.real_estate_showings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_id UUID,
  listing_id UUID,
  showing_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  outcome TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.real_estate_showings ENABLE ROW LEVEL SECURITY;

-- Insurance policies
CREATE TABLE public.insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_id UUID,
  policyholder_name TEXT NOT NULL,
  policy_number TEXT,
  policy_type TEXT NOT NULL DEFAULT 'auto',
  carrier TEXT,
  premium NUMERIC,
  effective_date DATE,
  renewal_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

-- Insurance quotes
CREATE TABLE public.insurance_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_id UUID,
  prospect_name TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'auto',
  carrier TEXT,
  premium_estimate NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_quotes ENABLE ROW LEVEL SECURITY;

-- Helper: org membership check (reuse existing pattern)
-- Assumes public.has_org_role(_user uuid, _org uuid, _roles text[]) exists OR profiles has organization_id.
-- Use a simple membership check via profiles.organization_id.

-- Generic policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['solar_projects','real_estate_listings','real_estate_showings','insurance_policies','insurance_quotes']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "org members read %1$s" ON public.%1$I
        FOR SELECT TO authenticated
        USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "org members insert %1$s" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "org members update %1$s" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "org members delete %1$s" ON public.%1$I
        FOR DELETE TO authenticated
        USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
    $f$, t);
  END LOOP;
END$$;

-- Updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['solar_projects','real_estate_listings','real_estate_showings','insurance_policies','insurance_quotes']
  LOOP
    EXECUTE format($f$
      CREATE TRIGGER trg_%1$s_updated_at
        BEFORE UPDATE ON public.%1$I
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    $f$, t);
  END LOOP;
END$$;

CREATE INDEX idx_solar_projects_org ON public.solar_projects(organization_id, status);
CREATE INDEX idx_re_listings_org ON public.real_estate_listings(organization_id, status);
CREATE INDEX idx_re_showings_org ON public.real_estate_showings(organization_id, showing_at);
CREATE INDEX idx_insurance_policies_org ON public.insurance_policies(organization_id, renewal_date);
CREATE INDEX idx_insurance_quotes_org ON public.insurance_quotes(organization_id, status);
