-- Many-to-many: a lead can be assigned to multiple org members.
-- We keep the existing leads.assigned_to column as the "primary" assignee
-- for backward compatibility, but the source of truth for "who is assigned"
-- becomes this join table.

CREATE TABLE IF NOT EXISTS public.lead_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, user_id)
);

CREATE INDEX IF NOT EXISTS lead_assignees_lead_id_idx ON public.lead_assignees(lead_id);
CREATE INDEX IF NOT EXISTS lead_assignees_user_id_idx ON public.lead_assignees(user_id);
CREATE INDEX IF NOT EXISTS lead_assignees_org_id_idx ON public.lead_assignees(organization_id);

ALTER TABLE public.lead_assignees ENABLE ROW LEVEL SECURITY;

-- Anyone in the org can see which employees are assigned to a lead.
CREATE POLICY "Org members view lead assignees"
  ON public.lead_assignees
  FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Anyone in the org can assign / unassign within their own org. We rely on
-- the leads RLS for the underlying lead access; UI restricts to owners.
CREATE POLICY "Org members insert lead assignees"
  ON public.lead_assignees
  FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members delete lead assignees"
  ON public.lead_assignees
  FOR DELETE
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Backfill: every existing lead with an assigned_to gets a row in the join
-- table so the new UI keeps showing the current assignee.
INSERT INTO public.lead_assignees (lead_id, user_id, organization_id)
SELECT id, assigned_to, organization_id
FROM public.leads
WHERE assigned_to IS NOT NULL
ON CONFLICT (lead_id, user_id) DO NOTHING;