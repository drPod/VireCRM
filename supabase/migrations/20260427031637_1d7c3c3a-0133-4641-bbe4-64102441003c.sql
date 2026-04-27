CREATE TABLE public.custom_domain_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_id UUID NULL REFERENCES public.org_custom_domains(id) ON DELETE SET NULL,
  hostname TEXT NOT NULL,
  user_id UUID NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'added',
    'removed',
    'set_primary',
    'verify_attempt',
    'verify_success',
    'verify_failed',
    'dns_lookup_failed',
    'auto_verify_started',
    'auto_verify_stopped'
  )),
  status TEXT NOT NULL DEFAULT 'info' CHECK (status IN ('info', 'success', 'warning', 'error')),
  message TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_domain_audit_org_created
  ON public.custom_domain_audit_log (organization_id, created_at DESC);

CREATE INDEX idx_custom_domain_audit_domain
  ON public.custom_domain_audit_log (domain_id, created_at DESC);

ALTER TABLE public.custom_domain_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners can view custom domain audit log"
ON public.custom_domain_audit_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::public.app_role, organization_id)
);

CREATE POLICY "Org members can insert audit log entries"
ON public.custom_domain_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  AND (user_id IS NULL OR user_id = auth.uid())
);

REVOKE UPDATE, DELETE ON public.custom_domain_audit_log FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_custom_domain_event(
  p_org_id UUID,
  p_domain_id UUID,
  p_hostname TEXT,
  p_event_type TEXT,
  p_status TEXT,
  p_message TEXT,
  p_details JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  INSERT INTO public.custom_domain_audit_log (
    organization_id, domain_id, hostname, user_id,
    event_type, status, message, details
  )
  VALUES (
    p_org_id, p_domain_id, lower(p_hostname), v_user,
    p_event_type, COALESCE(p_status, 'info'),
    NULLIF(TRIM(p_message), ''),
    COALESCE(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_custom_domain_event(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;