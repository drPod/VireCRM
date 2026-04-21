-- 1. Move pg_net out of public. It doesn't support ALTER EXTENSION SET SCHEMA,
--    so we drop and re-create it in the extensions schema.
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Tighten error_logs INSERT policy
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

CREATE POLICY "Insert error logs with own identity"
ON public.error_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL AND organization_id IS NULL)
  OR
  (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (organization_id IS NULL OR organization_id = public.get_user_org_id(auth.uid()))
  )
);

-- 3. Tighten support_tickets INSERT policy
DROP POLICY IF EXISTS "Anyone can submit a ticket" ON public.support_tickets;

CREATE POLICY "Submit a ticket with own identity"
ON public.support_tickets
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL AND organization_id IS NULL)
  OR
  (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (organization_id IS NULL OR organization_id = public.get_user_org_id(auth.uid()))
  )
);