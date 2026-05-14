-- Fix solar_projects, real_estate_listings, real_estate_showings,
-- insurance_policies, insurance_quotes: their RLS used profiles.id = auth.uid()
-- but profiles.id is a separate uuid (PK) distinct from profiles.user_id.
-- Recreate every policy using public.get_user_org_id(auth.uid()) which
-- internally joins on profiles.user_id = auth.uid().

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'solar_projects',
    'real_estate_listings',
    'real_estate_showings',
    'insurance_policies',
    'insurance_quotes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'org members read '   || v_table, v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'org members insert ' || v_table, v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'org members update ' || v_table, v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'org members delete ' || v_table, v_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()))',
      'org members read ' || v_table, v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id(auth.uid()))',
      'org members insert ' || v_table, v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id(auth.uid()))',
      'org members update ' || v_table, v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()))',
      'org members delete ' || v_table, v_table
    );
  END LOOP;
END $$;