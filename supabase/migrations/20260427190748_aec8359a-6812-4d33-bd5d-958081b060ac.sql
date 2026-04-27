CREATE POLICY "Org members update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()))
WITH CHECK (organization_id = get_user_org_id(auth.uid()));