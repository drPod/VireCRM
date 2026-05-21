-- Dead-letter table for Stripe webhook failures. The payments-webhook edge
-- function writes a row here whenever a credit-pack grant, org/user resolve,
-- or RPC call fails — so the platform-admin console can surface + replay
-- the broken events rather than leaving them silently dropped.

CREATE TABLE IF NOT EXISTS public.payment_webhook_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_id text,
  event_type text NOT NULL,
  stripe_object_id text,
  failure_kind text NOT NULL CHECK (
    failure_kind IN ('credit_grant', 'missing_user_id', 'missing_org_id', 'rpc_error')
  ),
  error_message text,
  raw_payload jsonb,
  replayed_at timestamptz,
  replayed_by uuid REFERENCES auth.users(id),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live'))
);

CREATE INDEX IF NOT EXISTS payment_webhook_failures_created_at_idx
  ON public.payment_webhook_failures (created_at DESC);

CREATE INDEX IF NOT EXISTS payment_webhook_failures_kind_created_at_idx
  ON public.payment_webhook_failures (failure_kind, created_at DESC);

ALTER TABLE public.payment_webhook_failures ENABLE ROW LEVEL SECURITY;

-- Platform admins only — read access. Writes are service-role from the
-- webhook (bypasses RLS), so no INSERT/UPDATE/DELETE policies are required.
DROP POLICY IF EXISTS payment_webhook_failures_admin_select ON public.payment_webhook_failures;
CREATE POLICY payment_webhook_failures_admin_select
  ON public.payment_webhook_failures
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

COMMENT ON TABLE public.payment_webhook_failures IS
  'Dead-letter log for Stripe webhook handling failures (credit-pack grants, org/user resolution misses, RPC errors). Read by platform admins for triage + replay; written by the payments-webhook edge function via service role.';
