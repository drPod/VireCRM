-- Stripe Connect accounts (one per organization)
CREATE TABLE public.client_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  country TEXT,
  default_currency TEXT,
  email TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their stripe account"
  ON public.client_stripe_accounts FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Service role manages stripe accounts"
  ON public.client_stripe_accounts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_client_stripe_accounts_updated_at
  BEFORE UPDATE ON public.client_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lead invoices (mirror of Stripe invoices clients send to their leads)
CREATE TABLE public.client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  stripe_account_id TEXT NOT NULL,
  stripe_invoice_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  number TEXT,
  description TEXT,
  amount_due_cents BIGINT NOT NULL DEFAULT 0,
  amount_paid_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'draft',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  interval TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  due_date TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_invoices_org ON public.client_invoices(organization_id);
CREATE INDEX idx_client_invoices_lead ON public.client_invoices(lead_id);
CREATE INDEX idx_client_invoices_status ON public.client_invoices(status);

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view org invoices"
  ON public.client_invoices FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners insert org invoices"
  ON public.client_invoices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Owners update org invoices"
  ON public.client_invoices FOR UPDATE
  USING (has_role(auth.uid(), 'owner'::app_role, organization_id))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role, organization_id));

CREATE POLICY "Service role manages invoices"
  ON public.client_invoices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_client_invoices_updated_at
  BEFORE UPDATE ON public.client_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-invoice rule on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS auto_invoice_on_stage TEXT,
  ADD COLUMN IF NOT EXISTS auto_invoice_template JSONB NOT NULL DEFAULT '{}'::jsonb;