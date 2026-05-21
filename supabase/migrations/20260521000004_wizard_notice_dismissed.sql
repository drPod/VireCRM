ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wizard_notice_dismissed boolean NOT NULL DEFAULT false;
