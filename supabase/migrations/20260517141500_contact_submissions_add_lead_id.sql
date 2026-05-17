-- contact_submissions was missing the lead_id column the app already expects.
-- src/routes/_app.contact-submissions.tsx selects it (line 102) and uses it to
-- build bulk-action recipient lists (lines 154-161). Without the column the
-- REST query 400s and the UI silently lies "No submissions match the current
-- filters".
--
-- Population is the classification/conversion path's job (out of scope here);
-- this migration just adds the column so the read side works and the column
-- can be wired up when conversion lands.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contact_submissions_lead_id_idx
  ON public.contact_submissions (lead_id)
  WHERE lead_id IS NOT NULL;
