-- contact_submissions
DROP POLICY IF EXISTS "Owners can view contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Owners can update contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Platform admins can update contact_submissions" ON public.contact_submissions;
CREATE POLICY "Platform admins can update contact_submissions"
  ON public.contact_submissions FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- system_settings
DROP POLICY IF EXISTS "Owners can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Owners can view system settings" ON public.system_settings;
CREATE POLICY "Platform admins can view system settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can manage system settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- outreach_templates
DROP POLICY IF EXISTS "Org owners/managers can insert outreach templates" ON public.outreach_templates;
DROP POLICY IF EXISTS "Org owners/managers can update outreach templates" ON public.outreach_templates;
DROP POLICY IF EXISTS "Org owners/managers can delete outreach templates" ON public.outreach_templates;

CREATE POLICY "Org owners/managers can insert outreach templates"
  ON public.outreach_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'manager'::app_role, organization_id))
  );

CREATE POLICY "Org owners/managers can update outreach templates"
  ON public.outreach_templates FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'manager'::app_role, organization_id))
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'manager'::app_role, organization_id))
  );

CREATE POLICY "Org owners/managers can delete outreach templates"
  ON public.outreach_templates FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'manager'::app_role, organization_id))
  );