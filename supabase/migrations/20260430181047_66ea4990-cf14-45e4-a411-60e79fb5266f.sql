CREATE OR REPLACE FUNCTION public.handle_new_contact_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  house_org UUID;
  new_task_id UUID;
  matched_lead_id UUID;
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

  -- Upsert lead by (organization_id, lower(email)). Manual upsert because
  -- there's no unique constraint on (org, lower(email)) — we don't want to
  -- add one (orgs may legitimately have duplicate-email leads from imports).
  -- Pick the most recently updated non-deleted match.
  SELECT id INTO matched_lead_id
  FROM public.leads
  WHERE organization_id = house_org
    AND deleted_at IS NULL
    AND lower(email) = lower(NEW.email)
  ORDER BY updated_at DESC
  LIMIT 1;

  IF matched_lead_id IS NULL THEN
    INSERT INTO public.leads (
      organization_id, name, email, phone, company,
      status, source, last_contact, notes, tags
    )
    VALUES (
      house_org,
      COALESCE(NULLIF(trim(NEW.name), ''), NEW.email),
      NEW.email,
      NEW.phone,
      NEW.company,
      'new',
      'contact-form',
      now(),
      'Initial message:' || E'\n' || NEW.message,
      ARRAY['contact-form']
    )
    RETURNING id INTO matched_lead_id;
  ELSE
    -- Refresh contact details (only fill blanks — never overwrite richer
    -- existing data) and stamp the touch.
    UPDATE public.leads
    SET
      name         = COALESCE(NULLIF(name, ''), NULLIF(trim(NEW.name), ''), email),
      phone        = COALESCE(phone, NEW.phone),
      company      = COALESCE(company, NEW.company),
      last_contact = now(),
      notes        = COALESCE(notes || E'\n\n', '') ||
                     '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '] '
                     || 'Contact form: ' || NEW.message,
      tags         = (
        SELECT array_agg(DISTINCT t)
        FROM unnest(COALESCE(tags, ARRAY[]::text[]) || ARRAY['contact-form']) AS t
      ),
      updated_at   = now()
    WHERE id = matched_lead_id;
  END IF;

  NEW.lead_id := matched_lead_id;

  task_title := 'Follow up: ' || COALESCE(NEW.name, NEW.email);
  task_desc :=
    'New contact form submission from ' || COALESCE(NEW.name, 'visitor') ||
    ' <' || NEW.email || '>' ||
    CASE WHEN NEW.company IS NOT NULL THEN E'\nCompany: ' || NEW.company ELSE '' END ||
    CASE WHEN NEW.phone   IS NOT NULL THEN E'\nPhone: '   || NEW.phone   ELSE '' END ||
    CASE WHEN NEW.budget  IS NOT NULL THEN E'\nBudget: '  || NEW.budget  ELSE '' END ||
    E'\n\nMessage:\n' || NEW.message;

  INSERT INTO public.tasks (
    organization_id, lead_id, title, description, status, priority, due_date
  )
  VALUES (
    house_org,
    matched_lead_id,
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
$function$;