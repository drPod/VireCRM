-- Add Stripe identifier columns to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Add Stripe transaction ID to transactions for idempotent webhook handling
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS stripe_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_stripe_transaction_id_key
  ON public.transactions(stripe_transaction_id)
  WHERE stripe_transaction_id IS NOT NULL;