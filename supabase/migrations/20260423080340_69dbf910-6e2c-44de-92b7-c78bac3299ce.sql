-- Add retention setting per organization (0 = never purge, otherwise days to keep)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS audit_log_retention_days INTEGER NOT NULL DEFAULT 90;

ALTER TABLE public.organizations
DROP CONSTRAINT IF EXISTS organizations_audit_log_retention_days_check;

ALTER TABLE public.organizations
ADD CONSTRAINT organizations_audit_log_retention_days_check
CHECK (audit_log_retention_days >= 0 AND audit_log_retention_days <= 3650);

-- Purge function: deletes audit entries older than the org's retention window.
-- Returns total rows deleted across all orgs.
CREATE OR REPLACE FUNCTION public.purge_advisor_audit_log()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_deleted INTEGER := 0;
  v_orgs_processed INTEGER := 0;
  v_org RECORD;
  v_deleted INTEGER;
BEGIN
  FOR v_org IN
    SELECT id, audit_log_retention_days
    FROM public.organizations
    WHERE audit_log_retention_days > 0
  LOOP
    DELETE FROM public.advisor_audit_log
    WHERE organization_id = v_org.id
      AND created_at < (now() - make_interval(days => v_org.audit_log_retention_days));

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_deleted;
    v_orgs_processed := v_orgs_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_total_deleted,
    'orgs_processed', v_orgs_processed,
    'ran_at', now()
  );
END;
$$;