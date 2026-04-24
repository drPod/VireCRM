-- 1. custom_roles table
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  base_role public.app_role NOT NULL DEFAULT 'sales_rep',
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_custom_roles_org ON public.custom_roles(organization_id);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view custom roles"
  ON public.custom_roles FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Owners insert custom roles"
  ON public.custom_roles FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

CREATE POLICY "Owners update custom roles"
  ON public.custom_roles FOR UPDATE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

CREATE POLICY "Owners delete non-builtin custom roles"
  ON public.custom_roles FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
    AND is_builtin = false
  );

CREATE POLICY "Service role manages custom roles"
  ON public.custom_roles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add custom_role_id to user_roles + invitations
ALTER TABLE public.user_roles
  ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

ALTER TABLE public.invitations
  ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 3. Seed built-in roles for every existing org
INSERT INTO public.custom_roles (organization_id, name, description, base_role, permissions, is_builtin, color)
SELECT
  o.id,
  'Owner',
  'Full access to everything in the organization.',
  'owner'::app_role,
  ARRAY[
    'leads.view','leads.create','leads.update','leads.delete','leads.assign',
    'campaigns.view','campaigns.manage',
    'tasks.view','tasks.manage',
    'commissions.view','commissions.manage',
    'expenses.view','expenses.manage',
    'team.manage','settings.manage','billing.manage',
    'reports.view','integrations.manage'
  ]::TEXT[],
  true,
  '#f59e0b'
FROM public.organizations o
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.custom_roles (organization_id, name, description, base_role, permissions, is_builtin, color)
SELECT
  o.id,
  'Manager',
  'Can manage leads, campaigns, tasks, and assign work to reps.',
  'manager'::app_role,
  ARRAY[
    'leads.view','leads.create','leads.update','leads.delete','leads.assign',
    'campaigns.view','campaigns.manage',
    'tasks.view','tasks.manage',
    'commissions.view',
    'expenses.view','expenses.manage',
    'reports.view'
  ]::TEXT[],
  true,
  '#6366f1'
FROM public.organizations o
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.custom_roles (organization_id, name, description, base_role, permissions, is_builtin, color)
SELECT
  o.id,
  'Sales Rep',
  'Can work assigned leads and tasks.',
  'sales_rep'::app_role,
  ARRAY[
    'leads.view','leads.create','leads.update',
    'campaigns.view',
    'tasks.view','tasks.manage',
    'commissions.view'
  ]::TEXT[],
  true,
  '#10b981'
FROM public.organizations o
ON CONFLICT (organization_id, name) DO NOTHING;

-- 4. Backfill existing user_roles with their built-in custom_role
UPDATE public.user_roles ur
SET custom_role_id = cr.id
FROM public.custom_roles cr
WHERE cr.organization_id = ur.organization_id
  AND cr.base_role = ur.role
  AND cr.is_builtin = true
  AND ur.custom_role_id IS NULL;

-- 5. Trigger to seed built-in roles for newly created orgs
CREATE OR REPLACE FUNCTION public.seed_builtin_roles_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.custom_roles (organization_id, name, description, base_role, permissions, is_builtin, color)
  VALUES
    (NEW.id, 'Owner', 'Full access to everything in the organization.', 'owner'::app_role,
      ARRAY['leads.view','leads.create','leads.update','leads.delete','leads.assign','campaigns.view','campaigns.manage','tasks.view','tasks.manage','commissions.view','commissions.manage','expenses.view','expenses.manage','team.manage','settings.manage','billing.manage','reports.view','integrations.manage']::TEXT[],
      true, '#f59e0b'),
    (NEW.id, 'Manager', 'Can manage leads, campaigns, tasks, and assign work to reps.', 'manager'::app_role,
      ARRAY['leads.view','leads.create','leads.update','leads.delete','leads.assign','campaigns.view','campaigns.manage','tasks.view','tasks.manage','commissions.view','expenses.view','expenses.manage','reports.view']::TEXT[],
      true, '#6366f1'),
    (NEW.id, 'Sales Rep', 'Can work assigned leads and tasks.', 'sales_rep'::app_role,
      ARRAY['leads.view','leads.create','leads.update','campaigns.view','tasks.view','tasks.manage','commissions.view']::TEXT[],
      true, '#10b981')
  ON CONFLICT (organization_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_builtin_roles_after_org_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_builtin_roles_for_org();

-- 6. Permission helper
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_org_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_role public.app_role;
  v_custom_role_id UUID;
  v_perms TEXT[];
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, custom_role_id
    INTO v_base_role, v_custom_role_id
  FROM public.user_roles
  WHERE user_id = p_user_id AND organization_id = p_org_id
  LIMIT 1;

  IF v_base_role IS NULL THEN
    RETURN false;
  END IF;

  -- Owners always have every permission
  IF v_base_role = 'owner'::app_role THEN
    RETURN true;
  END IF;

  -- Check assigned custom role first
  IF v_custom_role_id IS NOT NULL THEN
    SELECT permissions INTO v_perms
    FROM public.custom_roles
    WHERE id = v_custom_role_id AND organization_id = p_org_id;

    IF v_perms IS NOT NULL AND p_permission = ANY(v_perms) THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback to the built-in role permissions for the user's base_role
  SELECT permissions INTO v_perms
  FROM public.custom_roles
  WHERE organization_id = p_org_id
    AND base_role = v_base_role
    AND is_builtin = true
  LIMIT 1;

  RETURN v_perms IS NOT NULL AND p_permission = ANY(v_perms);
END;
$$;

-- 7. Update lead assignment trigger to use the new permission system
CREATE OR REPLACE FUNCTION public.enforce_lead_assignment_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    IF NOT public.user_has_permission(v_caller, NEW.organization_id, 'leads.assign') THEN
      RAISE EXCEPTION 'You do not have permission to assign leads';
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
$$;

-- 8. Update accept_invitation to honor the custom_role_id
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
  v_resolved_custom_role_id UUID;
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

  SELECT organization_id INTO v_old_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  UPDATE public.profiles
  SET organization_id = v_invitation.organization_id,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Resolve custom role: use the one on the invitation, or fall back to the
  -- built-in role for the invitation's base role
  v_resolved_custom_role_id := v_invitation.custom_role_id;
  IF v_resolved_custom_role_id IS NULL THEN
    SELECT id INTO v_resolved_custom_role_id
    FROM public.custom_roles
    WHERE organization_id = v_invitation.organization_id
      AND base_role = v_invitation.role
      AND is_builtin = true
    LIMIT 1;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, organization_id, role, custom_role_id)
  VALUES (v_user_id, v_invitation.organization_id, v_invitation.role, v_resolved_custom_role_id);

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

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
    'role', v_invitation.role,
    'custom_role_id', v_resolved_custom_role_id
  );
END;
$$;

-- 9. RPC to assign a custom role to an existing member
CREATE OR REPLACE FUNCTION public.assign_custom_role(
  p_user_id UUID,
  p_custom_role_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_org_id UUID;
  v_role_org UUID;
  v_role_base public.app_role;
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

  SELECT organization_id, base_role INTO v_role_org, v_role_base
  FROM public.custom_roles WHERE id = p_custom_role_id;

  IF v_role_org IS NULL OR v_role_org <> v_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Custom role not found in your organization');
  END IF;

  -- Don't let owners be downgraded via this RPC
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND organization_id = v_org_id AND role = 'owner'::app_role
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change an owner''s role via this action');
  END IF;

  -- Don't let custom role bump someone to owner
  IF v_role_base = 'owner'::app_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'The Owner role cannot be assigned this way');
  END IF;

  UPDATE public.user_roles
  SET role = v_role_base,
      custom_role_id = p_custom_role_id
  WHERE user_id = p_user_id AND organization_id = v_org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;