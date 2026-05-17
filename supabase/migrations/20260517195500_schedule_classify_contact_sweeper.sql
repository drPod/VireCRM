-- Schedule the contact-submission classify sweeper. Backstop for the
-- inline AI classify call in /api/public/contact, which we keep alive
-- past the Response on Cloudflare Workers via ExecutionContext.waitUntil
-- but which can still fail (Anthropic 5xx, rate limit, etc). The sweeper
-- picks up any row where classified_at IS NULL and retries.
--
-- Runs every 5 minutes — fast enough that a missed inline classify lands
-- in the CRM before the owner reads the inquiry email, slow enough that
-- a transient Anthropic outage doesn't hammer the API.
--
-- Idempotent: drop the prior schedule before re-scheduling.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'classify-contact-submissions') THEN
    PERFORM cron.unschedule('classify-contact-submissions');
  END IF;
END
$$;

SELECT cron.schedule(
  'classify-contact-submissions',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/classify-contact-submissions',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
