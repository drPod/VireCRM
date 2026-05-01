
-- Prevent non-platform-admins from changing organizations.industry_template.
-- Platform admin (and the service role / SECURITY DEFINER admin RPCs) can still change it.
CREATE OR REPLACE FUNCTION public.guard_industry_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act if the column actually changed
  IF NEW.industry_template IS DISTINCT FROM OLD.industry_template THEN
    -- service_role and superuser bypass everything
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Allow platform admins
    IF public.is_platform_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Only the platform admin can change the industry template'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_industry_template_change ON public.organizations;
CREATE TRIGGER guard_industry_template_change
BEFORE UPDATE OF industry_template ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.guard_industry_template_change();
