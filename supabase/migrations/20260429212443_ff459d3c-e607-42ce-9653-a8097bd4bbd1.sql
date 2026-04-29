
-- 1. system_settings table for project-wide configuration (e.g. genesis_house_org_id)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view system settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Owners can manage system settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));

-- 2. New columns on contact_submissions for follow-up tracking
ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created
  ON public.contact_submissions (status, created_at);

-- 3. Trigger function: auto-create a follow-up task in the Genesis house org
CREATE OR REPLACE FUNCTION public.handle_new_contact_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  house_org UUID;
  new_task_id UUID;
  task_title TEXT;
  task_desc TEXT;
BEGIN
  -- Skip test-mode submissions entirely.
  IF NEW.test_mode THEN
    RETURN NEW;
  END IF;

  -- Look up the configured house org. If unset, no-op (don't block insert).
  SELECT (value ->> 'org_id')::uuid
    INTO house_org
  FROM public.system_settings
  WHERE key = 'genesis_house_org_id';

  IF house_org IS NULL THEN
    RETURN NEW;
  END IF;

  task_title := 'Follow up: ' || COALESCE(NEW.name, NEW.email);
  task_desc :=
    'New contact form submission from ' || COALESCE(NEW.name, 'visitor') ||
    ' <' || NEW.email || '>' ||
    CASE WHEN NEW.company IS NOT NULL THEN E'\nCompany: ' || NEW.company ELSE '' END ||
    CASE WHEN NEW.phone   IS NOT NULL THEN E'\nPhone: '   || NEW.phone   ELSE '' END ||
    CASE WHEN NEW.budget  IS NOT NULL THEN E'\nBudget: '  || NEW.budget  ELSE '' END ||
    E'\n\nMessage:\n' || NEW.message;

  INSERT INTO public.tasks (organization_id, title, description, status, priority, due_date)
  VALUES (
    house_org,
    LEFT(task_title, 255),
    task_desc,
    'todo',
    'high',
    now() + INTERVAL '24 hours'
  )
  RETURNING id INTO new_task_id;

  NEW.task_id := new_task_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_submission_followup ON public.contact_submissions;
CREATE TRIGGER trg_contact_submission_followup
  BEFORE INSERT ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_contact_submission();
