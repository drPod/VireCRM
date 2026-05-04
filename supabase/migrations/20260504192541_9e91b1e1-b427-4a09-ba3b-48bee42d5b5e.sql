-- Service-role-callable variant of admin_set_org_plan_by_email so the
-- payments webhook (which runs as service_role, no auth.uid()) can grant
-- plans automatically when a platform invoice is paid.
CREATE OR REPLACE FUNCTION public.webhook_grant_plan_by_email(
  p_email text,
  p_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_old text;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email required';
  END IF;
  IF p_plan IS NULL OR length(trim(p_plan)) = 0 THEN
    RAISE EXCEPTION 'Plan required';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_user');
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_org');
  END IF;

  SELECT plan INTO v_old FROM public.organizations WHERE id = v_org_id;

  UPDATE public.organizations
  SET plan = p_plan, updated_at = now()
  WHERE id = v_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'org_id', v_org_id,
    'old_plan', v_old,
    'new_plan', p_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_grant_plan_by_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_grant_plan_by_email(text, text) TO service_role;