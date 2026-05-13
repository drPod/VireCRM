
CREATE TABLE IF NOT EXISTS public.admin_quote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.admin_quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status public.quote_status,
  to_status public.quote_status,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_quote_events_quote_id ON public.admin_quote_events(quote_id, created_at DESC);

ALTER TABLE public.admin_quote_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view quote events"
  ON public.admin_quote_events FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert quote events"
  ON public.admin_quote_events FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_admin_quote_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_quote_events (quote_id, event_type, to_status, actor_user_id)
    VALUES (NEW.id, 'created', NEW.status, NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_quote_events (quote_id, event_type, from_status, to_status, actor_user_id)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_quote_event ON public.admin_quotes;
CREATE TRIGGER trg_admin_quote_event
  AFTER INSERT OR UPDATE OF status ON public.admin_quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_quote_event();

-- Backfill: synthesize history events for any quote that already has timestamps
INSERT INTO public.admin_quote_events (quote_id, event_type, to_status, actor_user_id, created_at)
SELECT id, 'created', 'draft'::public.quote_status, created_by, created_at
FROM public.admin_quotes q
WHERE NOT EXISTS (SELECT 1 FROM public.admin_quote_events e WHERE e.quote_id = q.id AND e.event_type = 'created');

INSERT INTO public.admin_quote_events (quote_id, event_type, from_status, to_status, created_at)
SELECT id, 'status_changed', 'draft'::public.quote_status, 'sent'::public.quote_status, sent_at
FROM public.admin_quotes q
WHERE sent_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.admin_quote_events e WHERE e.quote_id = q.id AND e.to_status = 'sent');

INSERT INTO public.admin_quote_events (quote_id, event_type, from_status, to_status, created_at)
SELECT id, 'status_changed', 'sent'::public.quote_status, 'paid'::public.quote_status, paid_at
FROM public.admin_quotes q
WHERE paid_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.admin_quote_events e WHERE e.quote_id = q.id AND e.to_status = 'paid');
