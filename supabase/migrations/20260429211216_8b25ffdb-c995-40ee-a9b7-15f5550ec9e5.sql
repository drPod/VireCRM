ALTER TABLE public.contact_submissions
  ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX idx_contact_submissions_lead_id ON public.contact_submissions (lead_id);