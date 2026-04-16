
-- Fix: Restrict profile INSERT so users can't point to arbitrary orgs
-- The handle_new_user trigger (SECURITY DEFINER) creates profiles on signup,
-- so regular authenticated users should not normally need to insert profiles.
-- But if they do, the org_id must match what's in their existing profile.

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Only allow profile insert if user_id matches AND they already belong to that org
-- (the trigger handles initial creation; this blocks manual manipulation)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Also restrict profile UPDATE to prevent changing organization_id
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );
