
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence for human-readable quote numbers
CREATE SEQUENCE IF NOT EXISTS public.admin_quotes_seq START 1000;

CREATE TABLE IF NOT EXISTS public.admin_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL DEFAULT ('Q-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.admin_quotes_seq')::text, 4, '0')),
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_company TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status public.quote_status NOT NULL DEFAULT 'draft',
  payment_link_url TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  valid_until DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_quotes_status ON public.admin_quotes(status);
CREATE INDEX IF NOT EXISTS idx_admin_quotes_created_at ON public.admin_quotes(created_at DESC);

ALTER TABLE public.admin_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all quotes"
  ON public.admin_quotes FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can create quotes"
  ON public.admin_quotes FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update quotes"
  ON public.admin_quotes FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete quotes"
  ON public.admin_quotes FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_admin_quotes_updated_at
  BEFORE UPDATE ON public.admin_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
