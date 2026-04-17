-- Queue of pending welcome emails for newly created clients.
-- Rows are inserted by create-client-account and consumed by /hooks/send-pending-welcomes.
CREATE TABLE IF NOT EXISTS public.pending_welcome_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reseller_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  full_name text,
  brand_name text,
  login_url text NOT NULL,
  send_after timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  sent_at timestamptz,
  failed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_welcome_emails_due
  ON public.pending_welcome_emails (send_after)
  WHERE sent_at IS NULL AND failed_at IS NULL;

ALTER TABLE public.pending_welcome_emails ENABLE ROW LEVEL SECURITY;

-- No public access: only the service role (used by the create-client-account
-- edge function and the /hooks/send-pending-welcomes server route) reads/writes this table.
-- We intentionally add no policies, so RLS denies all access from anon/authenticated.
