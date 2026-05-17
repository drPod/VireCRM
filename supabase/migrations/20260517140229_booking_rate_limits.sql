-- Per-IP rate-limit + dedup audit table for the public bookPublicAppointmentFn
-- endpoint. The contact form re-uses contact_submissions for the same job, but
-- bookings don't have an equivalent audit table (appointments rows aren't a
-- safe surface for spam events because real users see them), so we add a
-- dedicated table here. Kept narrow so a future shared rate-limit table can
-- subsume it without painful data migration.
--
-- One row per attempt (allowed OR rejected). Service-role-only; not exposed
-- via PostgREST.
CREATE TABLE IF NOT EXISTS public.public_booking_attempts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id  UUID         NULL,
  ip_address   TEXT         NULL,
  email        TEXT         NULL,
  starts_at    TIMESTAMPTZ  NULL,
  outcome      TEXT         NOT NULL CHECK (outcome IN (
    'created',
    'duplicate',
    'rate_limited',
    'captcha_failed',
    'honeypot_tripped',
    'conflict',
    'invalid'
  )),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Range scans for the rate limiter (last 10min / last 24h) and dedup window.
CREATE INDEX IF NOT EXISTS idx_public_booking_attempts_ip_created
  ON public.public_booking_attempts (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_booking_attempts_dedup
  ON public.public_booking_attempts (calendar_id, email, starts_at, created_at DESC);

-- Service-role-only: RLS enabled but no policies → blocks anon + authenticated.
-- The booking endpoint uses the service-role client, which bypasses RLS.
ALTER TABLE public.public_booking_attempts ENABLE ROW LEVEL SECURITY;
