-- Grant platform admin to an existing user by email
CREATE OR REPLACE FUNCTION public.grant_platform_admin_by_email(
  p_email text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_caller IS NULL OR NOT public.is_platform_admin(v_caller) THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email required';
  END IF;

  SELECT id INTO v_target
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user with that email — they must sign up first');
  END IF;

  INSERT INTO public.platform_admins (user_id, granted_by, notes)
  VALUES (v_target, v_caller, p_notes)
  ON CONFLICT (user_id) DO UPDATE
    SET notes = COALESCE(EXCLUDED.notes, public.platform_admins.notes);

  RETURN jsonb_build_object('success', true, 'user_id', v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_platform_admin_by_email(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_platform_admin_by_email(text, text) TO authenticated;

-- Revoke platform admin
CREATE OR REPLACE FUNCTION public.revoke_platform_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_remaining int;
BEGIN
  IF v_caller IS NULL OR NOT public.is_platform_admin(v_caller) THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF p_user_id = v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot revoke your own admin access');
  END IF;

  DELETE FROM public.platform_admins WHERE user_id = p_user_id;

  SELECT count(*) INTO v_remaining FROM public.platform_admins;
  IF v_remaining = 0 THEN
    -- Safety: never leave the platform with zero admins. Re-insert.
    INSERT INTO public.platform_admins (user_id, granted_by, notes)
    VALUES (v_caller, v_caller, 'Auto-restored: cannot leave platform with zero admins');
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the last platform admin');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_platform_admin(uuid) TO authenticated;

-- List platform admins with email
CREATE OR REPLACE FUNCTION public.admin_list_platform_admins()
RETURNS TABLE (
  user_id uuid,
  email text,
  granted_at timestamptz,
  granted_by_email text,
  notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  RETURN QUERY
  SELECT
    pa.user_id,
    u.email::text,
    pa.granted_at,
    gb.email::text AS granted_by_email,
    pa.notes
  FROM public.platform_admins pa
  LEFT JOIN auth.users u ON u.id = pa.user_id
  LEFT JOIN auth.users gb ON gb.id = pa.granted_by
  ORDER BY pa.granted_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_platform_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_platform_admins() TO authenticated;