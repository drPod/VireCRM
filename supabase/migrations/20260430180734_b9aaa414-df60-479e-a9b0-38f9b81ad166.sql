CREATE INDEX IF NOT EXISTS idx_contact_submissions_dedup
  ON public.contact_submissions (email, ((metadata->>'dedup_hash')), created_at DESC)
  WHERE (metadata->>'dedup_hash') IS NOT NULL;