-- Schedule the welcome-email dispatcher via pg_cron: once a minute, the
-- pending_welcome_emails queue is drained by POSTing to the Cloudflare
-- Worker route /hooks/send-pending-welcomes.
--
-- Background: a prior migration (20260417054233_*.sql) tried to schedule
-- this same job against the now-dead `auto-pilot-sales-ace.lovable.app`
-- host with a JWT signed for the previous Supabase project ref
-- (mtcthkzvpfctjanehgdr). That schedule never landed on the current
-- project, so welcome emails sit forever in pending status. This
-- migration replaces it with the right URL + the shared CRON_SECRET
-- pattern already used by drain-workflow-queue and classify-contact-sweeper.
--
-- CRON_SECRET lives in vault.decrypted_secrets so it can rotate without
-- editing this migration. The Worker compares it against the
-- x-cron-secret header.
--
-- Idempotent: unschedule any prior job with the same name before scheduling.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-pending-welcomes') THEN
    PERFORM cron.unschedule('send-pending-welcomes');
  END IF;
END
$$;

SELECT cron.schedule(
  'send-pending-welcomes',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/hooks/send-pending-welcomes',
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
