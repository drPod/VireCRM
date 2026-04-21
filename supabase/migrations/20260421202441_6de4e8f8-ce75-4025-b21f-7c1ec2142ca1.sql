-- Lead sync log: records every lead-fetching run (Auto-Find, Apollo list import, etc.)
CREATE TABLE public.lead_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  fetched INTEGER NOT NULL DEFAULT 0,
  revealed INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  no_email INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_sync_log_org_created
  ON public.lead_sync_log (organization_id, created_at DESC);

ALTER TABLE public.lead_sync_log ENABLE ROW LEVEL SECURITY;

-- Org members can view runs for their organization
CREATE POLICY "Org members view lead sync log"
ON public.lead_sync_log
FOR SELECT
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Service role manages all rows (insert/update from server functions)
CREATE POLICY "Service role manages lead sync log"
ON public.lead_sync_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');