-- Invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'sales_rep',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(lower(email));

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Owners can manage invitations in their org
CREATE POLICY "Owners can manage invitations"
  ON public.invitations
  FOR ALL
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
    AND invited_by = auth.uid()
  );

-- Org members can view invitations in their org (so managers see them too)
CREATE POLICY "Members can view org invitations"
  ON public.invitations
  FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Function: accept invitation
-- Moves the calling user from their auto-created org into the inviting org.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_old_org_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  IF lower(v_invitation.email) <> lower(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address');
  END IF;

  -- Get the user's current (auto-created) org so we can clean it up
  SELECT organization_id INTO v_old_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Move profile to the new org
  UPDATE public.profiles
  SET organization_id = v_invitation.organization_id,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Replace user_roles with the invited role in the new org
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_invitation.organization_id, v_invitation.role);

  -- Mark invitation accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  -- Best-effort delete the now-orphaned old org (only if it has no other members)
  IF v_old_org_id IS NOT NULL AND v_old_org_id <> v_invitation.organization_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE organization_id = v_old_org_id
    ) THEN
      DELETE FROM public.organizations WHERE id = v_old_org_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'role', v_invitation.role
  );
END;
$$;

-- Function: remove a member from an organization (owner only)
CREATE OR REPLACE FUNCTION public.remove_org_member(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_org_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_caller = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot remove yourself');
  END IF;

  v_org_id := public.get_user_org_id(v_caller);
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No organization');
  END IF;

  IF NOT public.has_role(v_caller, 'owner'::app_role, v_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only owners can remove members');
  END IF;

  -- Make sure target user is in the same org
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND organization_id = v_org_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a member of your organization');
  END IF;

  -- Don't allow removing another owner
  IF public.has_role(p_user_id, 'owner'::app_role, v_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove another owner');
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND organization_id = v_org_id;

  DELETE FROM public.profiles
  WHERE user_id = p_user_id AND organization_id = v_org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function: change a member's role (owner only)
CREATE OR REPLACE FUNCTION public.update_member_role(p_user_id UUID, p_new_role public.app_role)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_org_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_org_id := public.get_user_org_id(v_caller);
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No organization');
  END IF;

  IF NOT public.has_role(v_caller, 'owner'::app_role, v_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only owners can change roles');
  END IF;

  IF v_caller = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot change your own role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND organization_id = v_org_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not in your organization');
  END IF;

  UPDATE public.user_roles
  SET role = p_new_role
  WHERE user_id = p_user_id AND organization_id = v_org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;