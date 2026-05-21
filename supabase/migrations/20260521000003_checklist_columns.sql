ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checklist_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checklist_items_completed text[] NOT NULL DEFAULT '{}';
