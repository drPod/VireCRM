-- 1) Column-level lockdown of transactions.raw_payload.
-- RLS still allows users to SELECT their own row, but reading raw_payload
-- now returns "permission denied for column". Service role keeps full access.
REVOKE SELECT (raw_payload) ON public.transactions FROM authenticated, anon;

-- 2) Harden has_role: keep the existing 3-arg signature with default NULL
-- (so we don't break dependent policies), but raise if org_id is NULL.
-- All current policies pass an explicit org_id, so this is defense-in-depth.
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role, p_org_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'has_role() requires an explicit organization_id (got NULL) to prevent cross-org privilege escalation';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role
      AND organization_id = p_org_id
  );
END;
$function$;