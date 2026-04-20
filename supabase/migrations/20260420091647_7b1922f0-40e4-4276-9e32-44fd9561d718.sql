CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url TEXT,
  user_agent TEXT,
  user_id UUID,
  organization_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. unauthenticated) can insert an error log so we never lose crash data
CREATE POLICY "Anyone can insert error logs"
ON public.error_logs
FOR INSERT
WITH CHECK (true);

-- Owners can view error logs for users in their org
CREATE POLICY "Owners view errors in their org"
ON public.error_logs
FOR SELECT
USING (
  organization_id IS NOT NULL
  AND public.has_role(auth.uid(), 'owner'::app_role, organization_id)
);

-- Service role full access
CREATE POLICY "Service role manages error logs"
ON public.error_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_org_id ON public.error_logs (organization_id) WHERE organization_id IS NOT NULL;