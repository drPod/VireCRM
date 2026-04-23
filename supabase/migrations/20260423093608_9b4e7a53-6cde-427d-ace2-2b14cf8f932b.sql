-- Pending subscription grants: pre-approved upgrades that activate at first sign-in
CREATE TABLE IF NOT EXISTS public.pending_subscription_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'enterprise',
  is_reseller BOOLEAN NOT NULL DEFAULT false,
  monthly_lead_quota INTEGER NOT NULL DEFAULT 999999,
  feature_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  granted_by TEXT,
  consumed_at TIMESTAMPTZ,
  consumed_user_id UUID,
  consumed_org_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_subscription_grants_email_active_idx
  ON public.pending_subscription_grants (LOWER(email))
  WHERE consumed_at IS NULL;

ALTER TABLE public.pending_subscription_grants ENABLE ROW LEVEL SECURITY;

-- Service role only — no client access.
CREATE POLICY "service role manages grants"
  ON public.pending_subscription_grants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Replace handle_new_user to consume any matching grant for this email
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
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Look up any pending grant for this email (case-insensitive)
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

  -- Apply granted feature flags
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

-- Make sure org_features has the unique constraint we just relied on
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_features_org_feature_key_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.org_features
        ADD CONSTRAINT org_features_org_feature_key_unique
        UNIQUE (organization_id, feature_key);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

-- Insert the grant for Crystal
INSERT INTO public.pending_subscription_grants (
  email, plan, is_reseller, monthly_lead_quota, feature_keys, notes, granted_by
)
VALUES (
  'crystal@greenenergiai.com',
  'enterprise',
  true,
  999999,
  ARRAY[
    'advanced_ai_advisor',
    'white_label_emails',
    'custom_workflow_nodes',
    'priority_lead_enrichment',
    'unlimited_leads',
    'api_access',
    'dedicated_support',
    'custom_reports'
  ],
  'Custom Enterprise White Label CRM — pre-paid',
  'platform_admin'
)
ON CONFLICT DO NOTHING;