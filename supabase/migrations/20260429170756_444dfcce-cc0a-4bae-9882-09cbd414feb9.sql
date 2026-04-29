
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score_reason TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';
CREATE INDEX IF NOT EXISTS idx_messages_lead_direction ON public.messages(lead_id, direction);
