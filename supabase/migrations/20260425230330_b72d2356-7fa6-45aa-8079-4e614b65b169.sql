-- Conversations (unified inbox)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'sms', -- sms, email, facebook, instagram, whatsapp, webchat
  subject text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open, snoozed, closed
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_org ON public.conversations(organization_id, last_message_at DESC);
CREATE INDEX idx_conversations_lead ON public.conversations(lead_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view conversations" ON public.conversations
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage conversations" ON public.conversations
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );
CREATE POLICY "Service role manages conversations" ON public.conversations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Conversation messages
CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound', -- inbound, outbound
  sender text,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_messages_conv ON public.conversation_messages(conversation_id, sent_at);
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view conversation messages" ON public.conversation_messages
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members insert conversation messages" ON public.conversation_messages
  FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage conversation messages" ON public.conversation_messages
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );
CREATE POLICY "Service role manages conversation messages" ON public.conversation_messages
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Calendars
CREATE TABLE public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text DEFAULT '#a855f7',
  slot_duration_minutes integer NOT NULL DEFAULT 30,
  buffer_minutes integer NOT NULL DEFAULT 0,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view calendars" ON public.calendars
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage calendars" ON public.calendars
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );

-- Appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_to uuid,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed', -- confirmed, pending, completed, no_show, canceled
  location text,
  meeting_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_org_start ON public.appointments(organization_id, starts_at);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view appointments" ON public.appointments
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage appointments" ON public.appointments
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );
CREATE POLICY "Reps update assigned appointments" ON public.appointments
  FOR UPDATE USING (organization_id = get_user_org_id(auth.uid()) AND assigned_to = auth.uid())
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND assigned_to = auth.uid());

-- Funnels / sites
CREATE TABLE public.funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  kind text NOT NULL DEFAULT 'funnel', -- funnel, website
  status text NOT NULL DEFAULT 'draft', -- draft, published, archived
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  visits_count integer NOT NULL DEFAULT 0,
  conversions_count integer NOT NULL DEFAULT 0,
  published_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view funnels" ON public.funnels
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage funnels" ON public.funnels
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );

-- Review requests
CREATE TABLE public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email', -- email, sms
  status text NOT NULL DEFAULT 'pending', -- pending, sent, responded, failed
  sent_at timestamptz,
  responded_at timestamptz,
  rating integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view review requests" ON public.review_requests
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage review requests" ON public.review_requests
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'google', -- google, facebook, yelp, internal
  rating integer NOT NULL DEFAULT 5,
  reviewer_name text,
  reviewer_avatar text,
  content text,
  reply_text text,
  replied boolean NOT NULL DEFAULT false,
  replied_at timestamptz,
  posted_at timestamptz NOT NULL DEFAULT now(),
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_org_posted ON public.reviews(organization_id, posted_at DESC);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view reviews" ON public.reviews
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Owners and managers manage reviews" ON public.reviews
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(),'owner'::app_role,organization_id) OR has_role(auth.uid(),'manager'::app_role,organization_id))
  );

-- updated_at triggers (reuse generic if exists; otherwise create one)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_conversations_touch BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_calendars_touch BEFORE UPDATE ON public.calendars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_appointments_touch BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_funnels_touch BEFORE UPDATE ON public.funnels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();