
-- =======================================================
-- Phase 5: Workflow execution runtime
-- =======================================================

-- 1) Runs + steps audit tables
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  triggered_by TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'lead_created' | 'status_changed' | 'message_received'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'completed' | 'failed' | 'paused'
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_org ON public.workflow_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status) WHERE status IN ('queued','running');

CREATE TABLE IF NOT EXISTS public.workflow_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_kind TEXT NOT NULL,
  status TEXT NOT NULL, -- 'ok' | 'error' | 'skipped'
  message TEXT,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_run ON public.workflow_run_steps(run_id, created_at);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read workflow runs"
ON public.workflow_runs FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Managers/owners manage workflow runs"
ON public.workflow_runs FOR ALL TO authenticated
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'owner'::app_role,organization_id)
    OR public.has_role(auth.uid(),'manager'::app_role,organization_id))
)
WITH CHECK (
  organization_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'owner'::app_role,organization_id)
    OR public.has_role(auth.uid(),'manager'::app_role,organization_id))
);

CREATE POLICY "Org members read workflow run steps"
ON public.workflow_run_steps FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workflow_runs r
  WHERE r.id = workflow_run_steps.run_id
    AND r.organization_id = public.get_user_org_id(auth.uid())
));

-- 2) Dispatcher: enqueue a run row for every active workflow matching trigger.
-- Triggers only enqueue. The pg_cron job + edge function process the queue
-- so we don't make synchronous outbound HTTP from a row trigger.

CREATE OR REPLACE FUNCTION public.enqueue_workflow_runs(
  p_org UUID,
  p_trigger TEXT,
  p_lead_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workflow_runs (organization_id, workflow_id, lead_id, triggered_by, status)
  SELECT w.organization_id, w.id, p_lead_id, p_trigger, 'queued'
  FROM public.workflows w
  WHERE w.organization_id = p_org
    AND w.status = 'active'
    AND w.trigger_type = p_trigger;
END;
$$;

-- Triggers on leads
CREATE OR REPLACE FUNCTION public.workflow_on_lead_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_workflow_runs(NEW.organization_id, 'lead_created', NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_workflow_lead_created ON public.leads;
CREATE TRIGGER trg_workflow_lead_created
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.workflow_on_lead_created();

CREATE OR REPLACE FUNCTION public.workflow_on_lead_status_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.enqueue_workflow_runs(NEW.organization_id, 'status_changed', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_workflow_lead_status_changed ON public.leads;
CREATE TRIGGER trg_workflow_lead_status_changed
AFTER UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.workflow_on_lead_status_changed();

-- Trigger on inbound messages (only direction='inbound')
CREATE OR REPLACE FUNCTION public.workflow_on_message_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound' THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO v_org FROM public.leads WHERE id = NEW.lead_id;
  IF v_org IS NOT NULL THEN
    PERFORM public.enqueue_workflow_runs(v_org, 'message_received', NEW.lead_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_workflow_message_received ON public.messages;
CREATE TRIGGER trg_workflow_message_received
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.workflow_on_message_received();
