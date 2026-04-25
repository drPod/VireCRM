-- Trigger that prevents non-entitled orgs from setting custom_domain.
-- Service role is exempt so platform admins / edge functions can always
-- override. The check looks for an active, non-expired org_features row with
-- feature_key = 'custom_domain'. Clearing the domain (NULL) is always allowed
-- so an org can disconnect even after the entitlement lapses.
CREATE OR REPLACE FUNCTION public.enforce_custom_domain_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_entitlement boolean;
BEGIN
  -- Allow service role unconditionally (edge functions, migrations, admins).
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- No-op or clearing the domain is always allowed.
  IF NEW.custom_domain IS NULL
    OR (TG_OP = 'UPDATE' AND NEW.custom_domain IS NOT DISTINCT FROM OLD.custom_domain) THEN
    RETURN NEW;
  END IF;

  -- Setting / changing to a non-null custom domain requires the flag.
  SELECT EXISTS (
    SELECT 1 FROM public.org_features
    WHERE organization_id = NEW.id
      AND feature_key = 'custom_domain'
      AND enabled = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_entitlement;

  IF NOT has_entitlement THEN
    RAISE EXCEPTION 'Custom domains require the Enterprise White-Label add-on. Contact support to enable it for your workspace.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- When the domain changes, also reset verification so the new value must
  -- prove ownership again. (Existing reset_domain_verification trigger may
  -- already do this; this is belt-and-suspenders.)
  IF TG_OP = 'UPDATE' AND NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
    NEW.domain_verified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_custom_domain_entitlement_trg ON public.organizations;
CREATE TRIGGER enforce_custom_domain_entitlement_trg
  BEFORE INSERT OR UPDATE OF custom_domain ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_custom_domain_entitlement();