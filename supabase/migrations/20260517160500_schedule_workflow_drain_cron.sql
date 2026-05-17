-- Schedule the workflow drain via pg_cron: once a minute, the queue is drained
-- by POSTing to the Cloudflare Worker route /api/public/hooks/run-workflows.
--
-- CRON_SECRET lives in vault.decrypted_secrets so we can rotate the value
-- without rewriting this migration. The Worker compares it against the
-- x-cron-secret header.
--
-- Idempotent: unschedule any prior job with the same name before scheduling.
-- pg_cron tolerates a missing job name on unschedule via the row-existence
-- guard.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-workflow-queue') THEN
    PERFORM cron.unschedule('drain-workflow-queue');
  END IF;
END
$$;

SELECT cron.schedule(
  'drain-workflow-queue',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/run-workflows',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);
