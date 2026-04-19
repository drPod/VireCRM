DROP FUNCTION IF EXISTS public.apply_refund_adjustment(text, text, integer, timestamptz, text);
DROP FUNCTION IF EXISTS public.apply_refund_adjustment CASCADE;

ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS paddle_customer_id CASCADE,
  DROP COLUMN IF EXISTS paddle_subscription_id CASCADE;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS paddle_subscription_id CASCADE,
  DROP COLUMN IF EXISTS paddle_transaction_id CASCADE;