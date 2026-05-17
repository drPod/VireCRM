-- Phase 1 cron backfill: schedule every worker hook that has been left without
-- a pg_cron driver since the Lovable host was killed.
--
-- All six jobs use the same convention already shipped by
-- drain-workflow-queue / classify-contact-submissions / send-pending-welcomes:
--   - POST to the Cloudflare Worker URL
--   - x-cron-secret header from vault.decrypted_secrets ('cron_secret')
--   - JSON content-type, empty body unless the route reads one
--
-- Schedules:
--   email-queue-process            * * * * *    every minute (visitor acks)
--   dispatch-sequences             * * * * *    every minute (per route)
--   dispatch-followups             */15 * * * * sweeper
--   contact-followup-reminders     0 * * * *    hourly per route comment
--   purge-audit-log                0 3 * * *    daily 03:00 UTC
--   calculate-payouts              0 2 1 * *    1st of month 02:00 UTC
--
-- Idempotent: each job unschedules a prior row of the same name before
-- scheduling. Safe to re-run.

DO $$
DECLARE
  job_names text[] := ARRAY[
    'email-queue-process',
    'dispatch-sequences',
    'dispatch-followups',
    'contact-followup-reminders',
    'purge-audit-log',
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

-- Email queue drainer — every minute. Most urgent: visitor acks sit in the
-- queue indefinitely without this.
SELECT cron.schedule(
  'email-queue-process',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/email/queue/process',
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

-- Outreach sequence dispatcher — every minute, drives the
-- outreach_sequence_enrollments due-queue.
SELECT cron.schedule(
  'dispatch-sequences',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/dispatch-sequences',
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

-- AI follow-up suggestion sweeper — flags orgs whose leads have gone stale.
-- Every 15 minutes is enough; the badge is non-time-critical.
SELECT cron.schedule(
  'dispatch-followups',
  '*/15 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/dispatch-followups',
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

-- Contact-submission follow-up reminders — hourly per the route's own
-- comment and its 24h reminder cooldown.
SELECT cron.schedule(
  'contact-followup-reminders',
  '0 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/contact-followup-reminders',
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

-- Advisor audit-log purge — daily at 03:00 UTC.
SELECT cron.schedule(
  'purge-audit-log',
  '0 3 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/purge-audit-log',
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

-- Reseller payouts — 1st of every month at 02:00 UTC, matching the route's
-- own DEFAULT period (previous calendar month).
SELECT cron.schedule(
  'calculate-payouts',
  '0 2 1 * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/hooks/calculate-payouts',
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
