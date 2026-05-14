-- 1. quote-pdfs bucket: make private; drop public read policy
UPDATE storage.buckets SET public = false WHERE id = 'quote-pdfs';

DROP POLICY IF EXISTS "Public can read quote pdfs" ON storage.objects;

-- Platform admins can read for direct downloads/checks
DROP POLICY IF EXISTS "Platform admins can read quote pdfs" ON storage.objects;
CREATE POLICY "Platform admins can read quote pdfs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-pdfs' AND public.is_platform_admin(auth.uid()));

-- 2. org_credit_settings: restrict SELECT to owners (Stripe IDs are sensitive)
DROP POLICY IF EXISTS "Org members can view credit settings" ON public.org_credit_settings;
CREATE POLICY "Owners can view credit settings"
  ON public.org_credit_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role, organization_id));

-- 3. pending_subscription_grants: add platform admin SELECT
DROP POLICY IF EXISTS "Platform admins can view grants" ON public.pending_subscription_grants;
CREATE POLICY "Platform admins can view grants"
  ON public.pending_subscription_grants FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 4. Realtime: admin_quotes / admin_quote_events do not need realtime broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_quotes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_quote_events;

-- 5. Harden is_platform_admin: only answer for the caller (or service_role)
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / SQL contexts (no auth.uid()) keep full access for trusted server code.
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id);
  END IF;

  -- Authenticated callers may only check themselves.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  RETURN EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated, service_role;

-- 6. Migrate calendar password hashes to a versioned salted format
--    Format going forward: "scrypt:<salt_hex>:<hash_hex>"  (set in app code)
--    Legacy SHA-256 hashes (no prefix) remain valid until the visitor next logs in,
--    at which point the app code re-hashes with scrypt and rewrites the column.
--    No data change needed here — the column is text and accepts both formats.
COMMENT ON COLUMN public.calendars.access_password_hash IS
  'Calendar access password. Format: "scrypt:<salt_hex>:<hash_hex>" (current) or bare 64-char SHA-256 hex (legacy, upgraded on next successful verify).';