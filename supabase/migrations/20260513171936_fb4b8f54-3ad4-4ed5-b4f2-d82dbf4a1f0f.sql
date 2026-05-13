ALTER TABLE public.admin_quotes
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS payment_link_environment text
    CHECK (payment_link_environment IN ('sandbox','live'));