-- Restrict user_belongs_to_org so it only answers for the calling user.
-- Prevents callers from probing other users' org memberships.
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_user_id uuid, p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_user_id = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = p_user_id AND organization_id = p_org_id
    )
    ELSE false
  END
$function$;