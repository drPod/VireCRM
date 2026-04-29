ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_leads_tags ON public.leads USING GIN (tags);

ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS paused_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_workflow_runs_paused ON public.workflow_runs (paused_until) WHERE status = 'paused';