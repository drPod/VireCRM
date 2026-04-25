
-- Sequences (top-level container)
CREATE TABLE public.outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  stop_on_reply BOOLEAN NOT NULL DEFAULT true,
  stop_on_positive_sentiment BOOLEAN NOT NULL DEFAULT false,
  stop_on_meeting_booked BOOLEAN NOT NULL DEFAULT true,
  send_window_start_hour INTEGER NOT NULL DEFAULT 9 CHECK (send_window_start_hour BETWEEN 0 AND 23),
  send_window_end_hour INTEGER NOT NULL DEFAULT 17 CHECK (send_window_end_hour BETWEEN 0 AND 23),
  send_on_weekends BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_sequences_org ON public.outreach_sequences(organization_id, status);

ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view sequences" ON public.outreach_sequences
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners and managers manage sequences" ON public.outreach_sequences
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'manager'::app_role, organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'manager'::app_role, organization_id))
  );

CREATE POLICY "Service role manages sequences" ON public.outreach_sequences
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Steps (ordered email touches inside a sequence)
CREATE TABLE public.outreach_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  template_id UUID REFERENCES public.outreach_templates(id) ON DELETE SET NULL,
  -- Inline override (used if no template_id)
  subject_override TEXT,
  body_override TEXT,
  -- Delay from previous step (or from enrollment if step_index = 0)
  delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  delay_hours INTEGER NOT NULL DEFAULT 0 CHECK (delay_hours BETWEEN 0 AND 23),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_index)
);

CREATE INDEX idx_outreach_sequence_steps_seq ON public.outreach_sequence_steps(sequence_id, step_index);

ALTER TABLE public.outreach_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view sequence steps" ON public.outreach_sequence_steps
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners and managers manage sequence steps" ON public.outreach_sequence_steps
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'manager'::app_role, organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'manager'::app_role, organization_id))
  );

CREATE POLICY "Service role manages sequence steps" ON public.outreach_sequence_steps
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Enrollments (one row per lead enrolled in a sequence)
CREATE TABLE public.outreach_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped','paused','failed')),
  stop_reason TEXT,
  enrolled_by UUID,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, lead_id)
);

CREATE INDEX idx_outreach_enrollments_due ON public.outreach_sequence_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX idx_outreach_enrollments_lead ON public.outreach_sequence_enrollments(lead_id, status);
CREATE INDEX idx_outreach_enrollments_seq ON public.outreach_sequence_enrollments(sequence_id, status);

ALTER TABLE public.outreach_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view enrollments" ON public.outreach_sequence_enrollments
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners and managers manage enrollments" ON public.outreach_sequence_enrollments
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'manager'::app_role, organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'manager'::app_role, organization_id))
  );

CREATE POLICY "Service role manages enrollments" ON public.outreach_sequence_enrollments
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Step execution log (audit + UI history)
CREATE TABLE public.outreach_sequence_step_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.outreach_sequence_enrollments(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL,
  step_id UUID,
  step_index INTEGER NOT NULL,
  lead_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  subject TEXT,
  error_message TEXT,
  message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_step_log_enrollment ON public.outreach_sequence_step_log(enrollment_id, sent_at DESC);
CREATE INDEX idx_outreach_step_log_sequence ON public.outreach_sequence_step_log(sequence_id, sent_at DESC);

ALTER TABLE public.outreach_sequence_step_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view step log" ON public.outreach_sequence_step_log
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role manages step log" ON public.outreach_sequence_step_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Updated_at triggers
CREATE TRIGGER update_outreach_sequences_updated_at
  BEFORE UPDATE ON public.outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_sequence_steps_updated_at
  BEFORE UPDATE ON public.outreach_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_enrollments_updated_at
  BEFORE UPDATE ON public.outreach_sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-stop enrollments when a reply comes in (if stop_on_reply is enabled)
CREATE OR REPLACE FUNCTION public.stop_sequences_on_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.outreach_sequence_enrollments e
  SET status = 'stopped',
      stop_reason = CASE
        WHEN NEW.sentiment = 'positive' THEN 'positive_reply'
        ELSE 'reply_received'
      END,
      stopped_at = now(),
      next_send_at = NULL
  FROM public.outreach_sequences s
  WHERE e.sequence_id = s.id
    AND e.lead_id = NEW.lead_id
    AND e.status = 'active'
    AND (
      s.stop_on_reply = true
      OR (s.stop_on_positive_sentiment = true AND NEW.sentiment = 'positive')
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stop_sequences_on_reply
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.stop_sequences_on_reply();

-- Auto-stop on meeting booked (appointment created for lead)
CREATE OR REPLACE FUNCTION public.stop_sequences_on_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.outreach_sequence_enrollments e
  SET status = 'stopped',
      stop_reason = 'meeting_booked',
      stopped_at = now(),
      next_send_at = NULL
  FROM public.outreach_sequences s
  WHERE e.sequence_id = s.id
    AND e.lead_id = NEW.lead_id
    AND e.status = 'active'
    AND s.stop_on_meeting_booked = true;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stop_sequences_on_meeting
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.stop_sequences_on_meeting();
