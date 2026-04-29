-- ====================================================
-- TRAINING ACADEMY
-- ====================================================

CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view published courses"
ON public.courses FOR SELECT
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (status = 'published' OR has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
);

CREATE POLICY "Owners and managers manage courses"
ON public.courses FOR ALL
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
);

CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  video_url TEXT,
  duration_minutes INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view lessons of accessible courses"
ON public.lessons FOR SELECT
USING (
  organization_id = get_user_org_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = lessons.course_id
      AND (c.status = 'published' OR has_role(auth.uid(), 'owner', c.organization_id) OR has_role(auth.uid(), 'manager', c.organization_id))
  )
);

CREATE POLICY "Owners and managers manage lessons"
ON public.lessons FOR ALL
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
);

CREATE TRIGGER update_lessons_updated_at
BEFORE UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lessons_course ON public.lessons(course_id, position);

CREATE TABLE public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress"
ON public.lesson_progress FOR ALL
USING (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()))
WITH CHECK (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners view all progress in org"
ON public.lesson_progress FOR SELECT
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'owner', organization_id)
);

-- ====================================================
-- GYM VERTICAL — MEMBER HEALTH
-- ====================================================

CREATE TABLE public.member_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL UNIQUE,
  organization_id UUID NOT NULL,
  last_visit_at TIMESTAMPTZ,
  visits_last_30 INTEGER NOT NULL DEFAULT 0,
  visits_prior_30 INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 50, -- 0-100
  risk_score INTEGER NOT NULL DEFAULT 0, -- 0-100, higher = more at risk
  goal TEXT, -- e.g. "Lose 10 lbs"
  goal_target NUMERIC,
  goal_current NUMERIC,
  goal_unit TEXT,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view member health"
ON public.member_health FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners and managers manage member health"
ON public.member_health FOR ALL
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id))
);

CREATE TRIGGER update_member_health_updated_at
BEFORE UPDATE ON public.member_health
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_member_health_org_risk ON public.member_health(organization_id, risk_score DESC);

-- ====================================================
-- AI FOLLOW-UP SUGGESTIONS
-- ====================================================

CREATE TABLE public.lead_followup_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email', -- email | sms | call
  subject TEXT,
  message TEXT NOT NULL,
  reasoning TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | dismissed | sent
  source TEXT NOT NULL DEFAULT 'on_demand', -- on_demand | batch
  created_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_followup_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view followup suggestions"
ON public.lead_followup_suggestions FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org members create followup suggestions"
ON public.lead_followup_suggestions FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners managers and creators update suggestions"
ON public.lead_followup_suggestions FOR UPDATE
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (has_role(auth.uid(), 'owner', organization_id) OR has_role(auth.uid(), 'manager', organization_id) OR created_by = auth.uid())
)
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Owners delete suggestions"
ON public.lead_followup_suggestions FOR DELETE
USING (
  organization_id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'owner', organization_id)
);

CREATE POLICY "Service role manages followup suggestions"
ON public.lead_followup_suggestions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_followup_suggestions_updated_at
BEFORE UPDATE ON public.lead_followup_suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_followup_org_status ON public.lead_followup_suggestions(organization_id, status, created_at DESC);
CREATE INDEX idx_followup_lead ON public.lead_followup_suggestions(lead_id, created_at DESC);