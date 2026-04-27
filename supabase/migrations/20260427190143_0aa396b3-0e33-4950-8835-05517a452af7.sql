
-- 1. Add created_by to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill: use existing assigned_to as the closest signal of "owner"
UPDATE public.leads
SET created_by = assigned_to
WHERE created_by IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);

-- 2. lead_shares table
CREATE TABLE IF NOT EXISTS public.lead_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  shared_by_user_id UUID NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_shares_lead ON public.lead_shares(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_shares_recipient ON public.lead_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_shares_sharer ON public.lead_shares(shared_by_user_id);

ALTER TABLE public.lead_shares ENABLE ROW LEVEL SECURITY;

-- 3. Helper: can the user access this lead at all (owner-of-org / creator / assignee / shared-with)?
CREATE OR REPLACE FUNCTION public.user_can_access_lead(p_user_id UUID, p_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_creator UUID;
  v_assigned UUID;
BEGIN
  IF p_user_id IS NULL OR p_lead_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT organization_id, created_by, assigned_to
    INTO v_org, v_creator, v_assigned
  FROM public.leads WHERE id = p_lead_id;

  IF v_org IS NULL THEN RETURN false; END IF;

  -- Org owners always see everything
  IF public.has_role(p_user_id, 'owner'::app_role, v_org) THEN
    RETURN true;
  END IF;

  -- Creator or primary assignee
  IF v_creator = p_user_id OR v_assigned = p_user_id THEN
    RETURN true;
  END IF;

  -- Shared with user
  RETURN EXISTS (
    SELECT 1 FROM public.lead_shares
    WHERE lead_id = p_lead_id AND shared_with_user_id = p_user_id
  );
END;
$$;

-- 4. Replace owner-only RLS on leads with creator/assignee/shared/owner
DROP POLICY IF EXISTS "Owners view leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Owners update leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Owners insert leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Owners delete leads in their org" ON public.leads;

CREATE POLICY "View accessible leads"
  ON public.leads FOR SELECT
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.lead_shares ls
        WHERE ls.lead_id = leads.id AND ls.shared_with_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Insert leads in own org"
  ON public.leads FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (created_by IS NULL OR created_by = auth.uid()
         OR has_role(auth.uid(), 'owner'::app_role, organization_id))
  );

CREATE POLICY "Update accessible leads"
  ON public.leads FOR UPDATE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.lead_shares ls
        WHERE ls.lead_id = leads.id AND ls.shared_with_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners or creators delete leads"
  ON public.leads FOR DELETE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR created_by = auth.uid()
    )
  );

-- 5. RLS for lead_shares (only sharer/recipient/owner)
CREATE POLICY "View own shares"
  ON public.lead_shares FOR SELECT
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR shared_by_user_id = auth.uid()
      OR shared_with_user_id = auth.uid()
    )
  );

-- Inserts/deletes go through RPCs (security definer) — block direct writes
CREATE POLICY "Service role manages shares"
  ON public.lead_shares FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. RPC: share_lead
CREATE OR REPLACE FUNCTION public.share_lead(
  p_lead_id UUID,
  p_recipient_user_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_org UUID;
  v_creator UUID;
  v_assigned UUID;
  v_share_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT organization_id, created_by, assigned_to
    INTO v_org, v_creator, v_assigned
  FROM public.leads WHERE id = p_lead_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  -- Caller must be creator, primary assignee, or org owner
  IF NOT (
    v_creator = v_caller
    OR v_assigned = v_caller
    OR public.has_role(v_caller, 'owner'::app_role, v_org)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can only share leads you own');
  END IF;

  -- Recipient must belong to the same org
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_recipient_user_id AND organization_id = v_org
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient is not in your organization');
  END IF;

  IF p_recipient_user_id = v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot share a lead with yourself');
  END IF;

  INSERT INTO public.lead_shares (
    organization_id, lead_id, shared_with_user_id, shared_by_user_id, message
  )
  VALUES (v_org, p_lead_id, p_recipient_user_id, v_caller, NULLIF(TRIM(p_message), ''))
  ON CONFLICT (lead_id, shared_with_user_id) DO UPDATE
    SET message = EXCLUDED.message,
        shared_by_user_id = EXCLUDED.shared_by_user_id
  RETURNING id INTO v_share_id;

  RETURN jsonb_build_object('success', true, 'share_id', v_share_id);
END;
$$;

-- 7. RPC: unshare_lead
CREATE OR REPLACE FUNCTION public.unshare_lead(
  p_lead_id UUID,
  p_recipient_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_org UUID;
  v_creator UUID;
  v_assigned UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT organization_id, created_by, assigned_to
    INTO v_org, v_creator, v_assigned
  FROM public.leads WHERE id = p_lead_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  -- Allow: owner of lead (creator/assignee), org owner, or the recipient removing themselves
  IF NOT (
    v_creator = v_caller
    OR v_assigned = v_caller
    OR public.has_role(v_caller, 'owner'::app_role, v_org)
    OR p_recipient_user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not allowed');
  END IF;

  DELETE FROM public.lead_shares
  WHERE lead_id = p_lead_id AND shared_with_user_id = p_recipient_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
