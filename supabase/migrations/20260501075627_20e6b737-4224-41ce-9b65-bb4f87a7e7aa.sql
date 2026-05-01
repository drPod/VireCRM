-- 1) Audit table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_assignment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_is_platform_admin boolean NOT NULL DEFAULT false,
  old_template text,
  new_template text,
  -- 'changed' = template was successfully updated; 'denied' = guard trigger
  -- blocked the change. Constrain to known values so the dashboard can rely
  -- on these labels.
  action text NOT NULL CHECK (action IN ('changed', 'denied')),
  reason text,
  source text, -- 'admin_rpc' | 'direct_update' | 'trigger_guard' | etc.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpl_audit_org      ON public.template_assignment_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_tpl_audit_actor    ON public.template_assignment_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_tpl_audit_action   ON public.template_assignment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_tpl_audit_created  ON public.template_assignment_audit_log(created_at DESC);

ALTER TABLE public.template_assignment_audit_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read; only the service role / SECURITY DEFINER
-- triggers and RPCs (which set search_path = public) ever write to it.
DROP POLICY IF EXISTS "Platform admins can view template audit" ON public.template_assignment_audit_log;
CREATE POLICY "Platform admins can view template audit"
  ON public.template_assignment_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role manages template audit" ON public.template_assignment_audit_log;
CREATE POLICY "Service role manages template audit"
  ON public.template_assignment_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- 2) AFTER-UPDATE trigger: record every successful template change ---------
CREATE OR REPLACE FUNCTION public.log_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_is_admin boolean := false;
BEGIN
  IF NEW.industry_template IS NOT DISTINCT FROM OLD.industry_template THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT email::text INTO v_email FROM auth.users WHERE id = v_uid;
    v_is_admin := public.is_platform_admin(v_uid);
  END IF;

  INSERT INTO public.template_assignment_audit_log (
    organization_id, actor_user_id, actor_email, actor_is_platform_admin,
    old_template, new_template, action, source, metadata
  )
  VALUES (
    NEW.id,
    v_uid,
    v_email,
    v_is_admin,
    OLD.industry_template,
    NEW.industry_template,
    'changed',
    CASE WHEN auth.role() = 'service_role' THEN 'service_role' ELSE 'direct_update' END,
    jsonb_build_object('auth_role', auth.role())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_template_change ON public.organizations;
CREATE TRIGGER log_template_change
AFTER UPDATE OF industry_template ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.log_template_change();

-- 3) Replace the guard trigger so denied attempts are also captured --------
CREATE OR REPLACE FUNCTION public.guard_industry_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF NEW.industry_template IS NOT DISTINCT FROM OLD.industry_template THEN
    RETURN NEW;
  END IF;

  -- Service role + platform admin are allowed (success row written by AFTER trigger).
  IF auth.role() = 'service_role' OR public.is_platform_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT email::text INTO v_email FROM auth.users WHERE id = v_uid;
  END IF;

  -- Record the denial *before* raising so security review can see it.
  INSERT INTO public.template_assignment_audit_log (
    organization_id, actor_user_id, actor_email, actor_is_platform_admin,
    old_template, new_template, action, reason, source, metadata
  )
  VALUES (
    NEW.id, v_uid, v_email, false,
    OLD.industry_template, NEW.industry_template,
    'denied',
    'Non-admin attempted to change industry template',
    'trigger_guard',
    jsonb_build_object('auth_role', auth.role())
  );

  RAISE EXCEPTION 'Only the platform admin can change the industry template'
    USING ERRCODE = '42501';
END;
$$;

-- 4) List RPC for the admin console ----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_template_audit(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'created_at') DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'organization_id', a.organization_id,
      'organization_name', o.name,
      'actor_user_id', a.actor_user_id,
      'actor_email', a.actor_email,
      'actor_is_platform_admin', a.actor_is_platform_admin,
      'old_template', a.old_template,
      'new_template', a.new_template,
      'action', a.action,
      'reason', a.reason,
      'source', a.source,
      'metadata', a.metadata,
      'created_at', a.created_at
    ) AS row
    FROM public.template_assignment_audit_log a
    LEFT JOIN public.organizations o ON o.id = a.organization_id
    ORDER BY a.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
  ) sub;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_template_audit(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_template_audit(integer) TO authenticated;