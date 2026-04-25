-- Add optional access password to calendars for restricted booking links
ALTER TABLE public.calendars
  ADD COLUMN IF NOT EXISTS access_password_hash text;

COMMENT ON COLUMN public.calendars.access_password_hash IS
  'SHA-256 hex hash of the optional access password. When set, public booking requires the password.';