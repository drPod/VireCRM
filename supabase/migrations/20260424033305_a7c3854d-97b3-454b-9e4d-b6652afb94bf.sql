-- Add assigned_to to leads so owners/managers can assign leads to a sales rep.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID NULL;

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx
  ON public.leads (organization_id, assigned_to);

-- Tighten UPDATE access: any org member can still update most lead fields,
-- but only owners/managers may change the assignee. We enforce this with a
-- BEFORE UPDATE trigger so all clients (including the JS SDK) are covered.
CREATE OR REPLACE FUNCTION public.enforce_lead_assignment_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Authentication required to reassign leads';
    END IF;

    IF NOT (
      public.has_role(v_caller, 'owner'::app_role,   NEW.organization_id)
      OR public.has_role(v_caller, 'manager'::app_role, NEW.organization_id)
    ) THEN
      RAISE EXCEPTION 'Only owners and managers can assign leads';
    END IF;

    -- If a user is being set, make sure they belong to the same org
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
$$;

DROP TRIGGER IF EXISTS leads_enforce_assignment_role ON public.leads;
CREATE TRIGGER leads_enforce_assignment_role
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_assignment_role();