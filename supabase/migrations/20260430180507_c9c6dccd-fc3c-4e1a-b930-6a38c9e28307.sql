ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS intent_summary text,
  ADD COLUMN IF NOT EXISTS priority_suggestion text,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_error text;

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_sentiment_check;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_sentiment_check
  CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','negative','urgent'));

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_priority_check;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_priority_check
  CHECK (priority_suggestion IS NULL OR priority_suggestion IN ('low','medium','high','critical'));

CREATE INDEX IF NOT EXISTS idx_contact_submissions_unclassified
  ON public.contact_submissions (created_at)
  WHERE classified_at IS NULL;