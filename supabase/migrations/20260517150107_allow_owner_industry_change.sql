-- Allow organization owners (not just platform admins) to change their org's
-- industry_template. The previous guard rejected every non-platform-admin
-- update, which left real customers locked to "general" forever — there's no
-- platform admin they can ask. The OnboardingWizard silently skipped the
-- template step for owners as a result, and /settings had no affordance.
--
-- Audit coverage is unchanged: the existing AFTER trigger
-- `log_template_change` already writes a `changed` row to
-- `template_assignment_audit_log` on every successful update. We extend the
-- BEFORE guard to permit owners alongside service_role + platform_admin, and
-- keep the denial path for everyone else (recorded as 'denied' before raise).
--
-- Note: `has_role(p_user_id, p_role, p_org_id)` raises on a NULL org_id, so
-- we pass NEW.id explicitly. This trigger fires per-row so NEW is the
-- organization being updated.

CREATE OR REPLACE FUNCTION public.guard_industry_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_is_owner boolean := false;
BEGIN
  IF NEW.industry_template IS NOT DISTINCT FROM OLD.industry_template THEN
    RETURN NEW;
  END IF;

  -- Service role + platform admin bypass (success row written by AFTER trigger).
  IF auth.role() = 'service_role' OR public.is_platform_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  -- New: org owners can change their own org's industry template.
  IF v_uid IS NOT NULL THEN
    v_is_owner := public.has_role(v_uid, 'owner'::app_role, NEW.id);
  END IF;
  IF v_is_owner THEN
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
    'Non-owner attempted to change industry template',
    'trigger_guard',
    jsonb_build_object('auth_role', auth.role())
  );

  RAISE EXCEPTION 'Only the organization owner or platform admin can change the industry template'
    USING ERRCODE = '42501';
END;
$$;

-- Extend the AFTER-update logger so owner changes are tagged distinctly from
-- platform-admin direct updates. Schema unchanged — actor_role lives in
-- metadata jsonb so we don't have to backfill or migrate the audit table.
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
  v_is_owner boolean := false;
  v_actor_role text;
  v_source text;
BEGIN
  IF NEW.industry_template IS NOT DISTINCT FROM OLD.industry_template THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT email::text INTO v_email FROM auth.users WHERE id = v_uid;
    v_is_admin := public.is_platform_admin(v_uid);
    IF NOT v_is_admin THEN
      v_is_owner := public.has_role(v_uid, 'owner'::app_role, NEW.id);
    END IF;
  END IF;

  IF auth.role() = 'service_role' THEN
    v_actor_role := 'service_role';
    v_source := 'service_role';
  ELSIF v_is_admin THEN
    v_actor_role := 'platform_admin';
    v_source := 'direct_update';
  ELSIF v_is_owner THEN
    v_actor_role := 'owner';
    v_source := 'owner_self_serve';
  ELSE
    v_actor_role := 'unknown';
    v_source := 'direct_update';
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
    v_source,
    jsonb_build_object('auth_role', auth.role(), 'actor_role', v_actor_role)
  );

  RETURN NEW;
END;
$$;

-- Functions retain their existing EXECUTE grants (revoked from anon/public,
-- granted to authenticated/service_role) from
-- `20260517133315_lock_down_security_definer_funcs.sql` — no re-grant needed.
