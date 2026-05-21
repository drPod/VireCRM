-- Drop pg_cron jobs whose route handlers were removed alongside the reseller
-- scaffold cleanup. Both jobs were 500ing every fire:
--   send-pending-welcomes — handler /hooks/send-pending-welcomes deleted;
--     queried the dropped pending_welcome_emails table.
--   calculate-payouts — handler /hooks/calculate-payouts never existed in
--     this Worker; depended on dropped commission_rules / reseller_payouts.

DO $$
DECLARE
  job_names text[] := ARRAY[
    'send-pending-welcomes',
    'calculate-payouts'
  ];
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY job_names LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
      PERFORM cron.unschedule(job_name);
    END IF;
  END LOOP;
END
$$;
