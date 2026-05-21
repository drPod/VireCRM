-- Campaign Builder — wraps outreach_sequences as the user-facing layer.
-- See plan: campaigns become 1:1 with outreach_sequences. Audience snapshot
-- at launch, plaintext + Handlebars tokens, reuse dispatch-sequences cron.

-- 1. Add columns to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS audience_filter jsonb,
  ADD COLUMN IF NOT EXISTS from_name      text,
  ADD COLUMN IF NOT EXISTS reply_to       text,
  ADD COLUMN IF NOT EXISTS scheduled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS launched_at    timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz;

-- 2. Extend status CHECK to allow 'scheduled'
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft','scheduled','active','paused','completed'));

-- 3. Link sequence → campaign (1:1)
ALTER TABLE public.outreach_sequences
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_sequences_campaign
  ON public.outreach_sequences(campaign_id)
  WHERE campaign_id IS NOT NULL;

-- 4a. Trigger: bump campaigns.leads_count on enrollment insert
CREATE OR REPLACE FUNCTION public.bump_campaign_leads_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT campaign_id INTO v_campaign_id
  FROM public.outreach_sequences
  WHERE id = NEW.sequence_id;

  IF v_campaign_id IS NOT NULL THEN
    UPDATE public.campaigns
    SET leads_count = COALESCE(leads_count, 0) + 1,
        updated_at = now()
    WHERE id = v_campaign_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_campaign_leads_count ON public.outreach_sequence_enrollments;
CREATE TRIGGER trg_bump_campaign_leads_count
  AFTER INSERT ON public.outreach_sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.bump_campaign_leads_count();

-- 4b. Trigger: bump campaigns.sent_count when step_log row written with status='sent'
CREATE OR REPLACE FUNCTION public.bump_campaign_sent_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF NEW.status <> 'sent' THEN
    RETURN NEW;
  END IF;

  SELECT campaign_id INTO v_campaign_id
  FROM public.outreach_sequences
  WHERE id = NEW.sequence_id;

  IF v_campaign_id IS NOT NULL THEN
    UPDATE public.campaigns
    SET sent_count = COALESCE(sent_count, 0) + 1,
        updated_at = now()
    WHERE id = v_campaign_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_campaign_sent_count ON public.outreach_sequence_step_log;
CREATE TRIGGER trg_bump_campaign_sent_count
  AFTER INSERT ON public.outreach_sequence_step_log
  FOR EACH ROW EXECUTE FUNCTION public.bump_campaign_sent_count();

-- 4c. Trigger: bump campaigns.replies_count when a reply lands on an enrolled lead
CREATE OR REPLACE FUNCTION public.bump_campaign_replies_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.campaign_id INTO v_campaign_id
  FROM public.outreach_sequence_enrollments e
  JOIN public.outreach_sequences s ON s.id = e.sequence_id
  WHERE e.lead_id = NEW.lead_id
    AND s.campaign_id IS NOT NULL
  ORDER BY e.enrolled_at DESC
  LIMIT 1;

  IF v_campaign_id IS NOT NULL THEN
    UPDATE public.campaigns
    SET replies_count = COALESCE(replies_count, 0) + 1,
        updated_at = now()
    WHERE id = v_campaign_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_campaign_replies_count ON public.replies;
CREATE TRIGGER trg_bump_campaign_replies_count
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.bump_campaign_replies_count();

-- 5. pg_cron — launch scheduled campaigns every 5 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'campaigns-launch-scheduled') THEN
    PERFORM cron.unschedule('campaigns-launch-scheduled');
  END IF;
END
$$;

SELECT cron.schedule(
  'campaigns-launch-scheduled',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/launch-scheduled-campaigns',
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
