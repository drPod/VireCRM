ALTER TABLE public.admin_quotes REPLICA IDENTITY FULL;
ALTER TABLE public.admin_quote_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_quote_events;