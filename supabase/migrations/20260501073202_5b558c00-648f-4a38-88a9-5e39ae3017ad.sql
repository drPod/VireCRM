
CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.contact_submissions(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text,
  stripe_customer_id text,
  stripe_invoice_id text UNIQUE,
  hosted_invoice_url text,
  invoice_pdf text,
  number text,
  description text,
  amount_due_cents bigint NOT NULL DEFAULT 0,
  amount_paid_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'draft',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_date timestamptz,
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_submission ON public.platform_invoices(submission_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_email ON public.platform_invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status ON public.platform_invoices(status);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view invoices"
  ON public.platform_invoices FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert invoices"
  ON public.platform_invoices FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update invoices"
  ON public.platform_invoices FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete invoices"
  ON public.platform_invoices FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Service role can manage platform invoices"
  ON public.platform_invoices FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_platform_invoices_updated_at
BEFORE UPDATE ON public.platform_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
