-- Create ai_call_log table for diagnosing AI failures
CREATE TABLE public.ai_call_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID,
  user_id UUID,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  attempt_index INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  http_status INTEGER,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX idx_ai_call_log_org_created ON public.ai_call_log (organization_id, created_at DESC);
CREATE INDEX idx_ai_call_log_feature_created ON public.ai_call_log (feature, created_at DESC);
CREATE INDEX idx_ai_call_log_status ON public.ai_call_log (status) WHERE status <> 'success';

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view AI call log in their org"
ON public.ai_call_log
FOR SELECT
USING (
  organization_id IS NOT NULL
  AND has_role(auth.uid(), 'owner'::app_role, organization_id)
);

CREATE POLICY "Service role manages AI call log"
ON public.ai_call_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');