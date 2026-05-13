-- Add differentiators (array of {title, body}) and pdf_url to admin_quotes
ALTER TABLE public.admin_quotes
  ADD COLUMN IF NOT EXISTS differentiators jsonb NOT NULL DEFAULT '[
    {"title":"Built-in AI sales team","body":"Lead scoring, reply classification, follow-up writing, and meeting booking are first-class agents — not bolt-ons."},
    {"title":"One platform replaces 6+ tools","body":"CRM, outreach, scheduling, pipeline, billing, and reporting in one place. No Zapier glue."},
    {"title":"True white-label, not a reseller skin","body":"Your domain, your branding, your login, your customers. Genesis is invisible."},
    {"title":"Capped, transparent pricing","body":"Flat monthly tiers — no per-seat creep, no usage surprises."},
    {"title":"Industry-tuned templates","body":"Pre-built pipelines, automations, and email templates for solar, insurance, real estate, gym, and more."},
    {"title":"Real human + AI support","body":"Founders in the loop. Slack-grade response time, not a help-desk maze."}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- Public storage bucket for generated proposal PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-pdfs', 'quote-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read; platform admins can write/update/delete
DROP POLICY IF EXISTS "Public can read quote pdfs" ON storage.objects;
CREATE POLICY "Public can read quote pdfs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-pdfs');

DROP POLICY IF EXISTS "Platform admins can upload quote pdfs" ON storage.objects;
CREATE POLICY "Platform admins can upload quote pdfs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'quote-pdfs' AND public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can update quote pdfs" ON storage.objects;
CREATE POLICY "Platform admins can update quote pdfs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'quote-pdfs' AND public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can delete quote pdfs" ON storage.objects;
CREATE POLICY "Platform admins can delete quote pdfs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'quote-pdfs' AND public.is_platform_admin(auth.uid()));