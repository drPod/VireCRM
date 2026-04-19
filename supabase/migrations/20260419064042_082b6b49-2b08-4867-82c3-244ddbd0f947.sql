
-- 1. Drop the unscoped 2-arg has_role overload (privilege escalation risk).
-- All callsites use the 3-arg version (org-scoped). The 2-arg version returned
-- true if the user had the role in ANY org, which could let a user who is
-- "owner" of their own org pass owner checks against other orgs.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2. Pin search_path on pgmq wrapper functions to prevent search_path hijack.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 3. Lock down pending_welcome_emails: no authenticated user should ever
-- read/write it directly. Service role bypasses RLS, so the worker still works.
-- Explicit restrictive policies make intent clear and block any future
-- accidental anon/authenticated grants.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_welcome_emails'
      AND policyname = 'Block all client access to welcome email queue'
  ) THEN
    DROP POLICY "Block all client access to welcome email queue" ON public.pending_welcome_emails;
  END IF;
END $$;

ALTER TABLE public.pending_welcome_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all client access to welcome email queue"
  ON public.pending_welcome_emails
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
