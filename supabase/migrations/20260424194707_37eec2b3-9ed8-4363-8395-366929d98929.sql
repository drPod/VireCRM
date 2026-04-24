-- 1) Lock down leads SELECT/INSERT/UPDATE/DELETE to owners only
DROP POLICY IF EXISTS "Users can view leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their org" ON public.leads;

CREATE POLICY "Owners view leads in their org"
  ON public.leads FOR SELECT
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  );

CREATE POLICY "Owners insert leads in their org"
  ON public.leads FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  );

CREATE POLICY "Owners update leads in their org"
  ON public.leads FOR UPDATE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  );

CREATE POLICY "Owners delete leads in their org"
  ON public.leads FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  );

-- 2) Lock down lead_assignees writes to owners only (keep view for org members)
DROP POLICY IF EXISTS "Org members insert lead assignees" ON public.lead_assignees;
DROP POLICY IF EXISTS "Org members delete lead assignees" ON public.lead_assignees;

CREATE POLICY "Owners insert lead assignees"
  ON public.lead_assignees FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  );

CREATE POLICY "Owners delete lead assignees"
  ON public.lead_assignees FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
  );

-- 3) Tighten the assignment trigger: require 'owner' role specifically for
--    changes to leads.assigned_to (in addition to existing membership check).
CREATE OR REPLACE FUNCTION public.enforce_lead_assignment_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Authentication required to reassign leads';
    END IF;

    IF NOT public.has_role(v_caller, 'owner'::public.app_role, NEW.organization_id) THEN
      RAISE EXCEPTION 'Only owners can assign leads';
    END IF;

    IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = NEW.assigned_to
        AND organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Assignee must be a member of the lead''s organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;