
-- Audit log for AI Advisor commands, JSON plans, executions, and CRM updates
CREATE TABLE public.advisor_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  command TEXT NOT NULL,
  phase TEXT NOT NULL,           -- 'plan' | 'execute'
  summary TEXT,
  plan JSONB,                    -- the AI-generated plan (CommandPlan or AgentPlan)
  results JSONB,                 -- ExecutionResult[] when phase='execute'
  handlers JSONB,                -- { in_app: n, n8n: n }
  ok_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_advisor_audit_log_org_created
  ON public.advisor_audit_log (organization_id, created_at DESC);

ALTER TABLE public.advisor_audit_log ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's audit log
CREATE POLICY "Org members view advisor audit log"
ON public.advisor_audit_log
FOR SELECT
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Service role manages all rows (server functions write via supabaseAdmin)
CREATE POLICY "Service role manages advisor audit log"
ON public.advisor_audit_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
