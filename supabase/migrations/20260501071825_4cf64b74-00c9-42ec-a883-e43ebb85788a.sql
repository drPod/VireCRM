ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS project_type text;

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_project_type_check;

ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_project_type_check
  CHECK (
    project_type IS NULL OR project_type = ANY (ARRAY[
      'custom-crm',
      'white-label',
      'full-ownership',
      'enterprise',
      'integration',
      'other'
    ])
  );

CREATE INDEX IF NOT EXISTS idx_contact_submissions_project_type_created
  ON public.contact_submissions (project_type, created_at DESC)
  WHERE project_type IS NOT NULL;