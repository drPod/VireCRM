-- Returns { org_id, plan } JSON, or NULL if no org owner matches the email.
CREATE OR REPLACE FUNCTION public.admin_set_org_plan_by_email(
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
  v_new_plan text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email required';
  END IF;

  -- Find the auth user with this email (owners log in with their own email).
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Pick the org this user owns (or any org they belong to as a fallback).
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Reuse the existing assignment RPC for consistency (validation + audit).
  SELECT public.admin_set_org_plan(v_org_id, p_plan) INTO v_new_plan;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'plan', v_new_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_org_plan_by_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_org_plan_by_email(text, text) TO authenticated;