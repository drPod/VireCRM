-- =======================================================
-- Workflow engine runtime: retry support + resume-from-node
-- =======================================================
--
-- Existing tables (from 20260429171653_*.sql) already give us:
--   public.workflows                — graph + status
--   public.workflow_runs            — one row per execution attempt
--   public.workflow_run_steps       — per-node audit log
--   enqueue_workflow_runs()         — invoked by row triggers
--   trg_workflow_lead_created       — fires on leads INSERT
--   trg_workflow_lead_status_changed — fires on leads UPDATE
--   trg_workflow_message_received   — fires on inbound messages
--   workflow_runs.paused_until      — already added in 20260429172853_*.sql
--
-- This migration finishes the runtime so the cron worker can:
--   1) Track *which* node a paused/queued run should resume from (waits
--      otherwise restart the graph from the trigger every cron tick).
--   2) Retry transient failures with backoff (max 3 attempts).
--   3) Track visited node ids so a resumed run keeps the cycle guard intact.
--
-- The cron schedule itself is wired externally (the existing dispatch hooks
-- like dispatch-sequences are scheduled by the user's external cron runner,
-- not pg_cron — see commit dc4df81). Hitting POST /api/public/hooks/run-workflows
-- with x-cron-secret every minute drains the queue.

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS resume_node_id TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visited_node_ids TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Help the cron query find work cheaply.
CREATE INDEX IF NOT EXISTS idx_workflow_runs_next_attempt
  ON public.workflow_runs (next_attempt_at)
  WHERE status = 'queued';

COMMENT ON COLUMN public.workflow_runs.resume_node_id IS
  'Node id where the runner should pick up. NULL = start from the trigger node.';
COMMENT ON COLUMN public.workflow_runs.attempts IS
  'Number of times this run has entered the runner. Capped at 3 by the worker.';
COMMENT ON COLUMN public.workflow_runs.next_attempt_at IS
  'When the run should next be picked up (set on transient failure for backoff).';
COMMENT ON COLUMN public.workflow_runs.visited_node_ids IS
  'Cycle guard. Each node id appended as it executes so resumed runs do not loop.';
