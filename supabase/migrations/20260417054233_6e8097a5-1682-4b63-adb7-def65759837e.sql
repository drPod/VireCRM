-- Ensure pg_cron + pg_net are available (they already are, but be safe).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior version of this schedule before re-creating it.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'send-pending-welcomes';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END
$$;

-- Run every minute. Hits the published app URL; the route requires a Bearer token
-- (the public anon key is fine — the route only enforces presence, and all DB
-- access inside it uses the service role key from env).
SELECT cron.schedule(
  'send-pending-welcomes',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://auto-pilot-sales-ace.lovable.app/hooks/send-pending-welcomes',
    headers := '{"Content-Type": "application/json", "Lovable-Context": "cron", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y3Roa3p2cGZjdGphbmVoZ2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjA3NjUsImV4cCI6MjA5MTgzNjc2NX0.qk0BV7loi2eGNWtgLomMw8XtZB4gucMY45D-xFipQWw"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
