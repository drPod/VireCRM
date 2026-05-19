-- Add GUC short-circuit to handle_new_user so bulk auth-user imports can
-- bypass automatic org/profile/user_role provisioning.
--
-- Set `app.skip_auto_provision = 'on'` at session or transaction scope
-- before inserting into auth.users to skip the trigger body. Default off,
-- so normal signup flow is unchanged.
--
-- Used by scripts/migrate-lovable-to-fixed.ts (Lovable→fixed-DB port,
-- 2026-05-19). Postgres role cannot DISABLE TRIGGER on auth.users
-- (supabase_auth_admin owns the table), so we patch the trigger function
-- instead. The function is SECURITY DEFINER and owned by postgres, so
-- CREATE OR REPLACE is permitted.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  user_name TEXT;
  v_grant public.pending_subscription_grants%ROWTYPE;
  v_feature_key TEXT;
BEGIN
  IF current_setting('app.skip_auto_provision', true) = 'on' THEN
    RETURN NEW;
  END IF;

  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  SELECT * INTO v_grant
  FROM public.pending_subscription_grants
  WHERE LOWER(email) = LOWER(NEW.email)
    AND consumed_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.organizations (
    name, slug, brand_name, plan, is_reseller, monthly_lead_quota
  )
  VALUES (
    user_name || '''s Organization',
    LOWER(REPLACE(user_name, ' ', '-')) || '-' || SUBSTRING(NEW.id::text, 1, 8),
    user_name || '''s CRM',
    COALESCE(v_grant.plan, 'starter'),
    COALESCE(v_grant.is_reseller, false),
    COALESCE(v_grant.monthly_lead_quota, 25)
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (NEW.id, new_org_id, user_name);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  IF v_grant.id IS NOT NULL AND array_length(v_grant.feature_keys, 1) > 0 THEN
    FOREACH v_feature_key IN ARRAY v_grant.feature_keys LOOP
      INSERT INTO public.org_features (organization_id, feature_key, enabled, notes)
      VALUES (new_org_id, v_feature_key, true, COALESCE(v_grant.notes, 'Granted via pre-paid enterprise package'))
      ON CONFLICT (organization_id, feature_key) DO UPDATE
        SET enabled = true, updated_at = now();
    END LOOP;

    UPDATE public.pending_subscription_grants
    SET consumed_at = now(),
        consumed_user_id = NEW.id,
        consumed_org_id = new_org_id
    WHERE id = v_grant.id;
  END IF;

  RETURN NEW;
END;
$function$;
