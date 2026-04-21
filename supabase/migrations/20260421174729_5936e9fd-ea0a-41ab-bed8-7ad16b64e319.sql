-- Allow reseller owners to view subscriptions attributed to their reseller org
CREATE POLICY "Reseller owners view attributed subscriptions"
ON public.subscriptions
FOR SELECT
USING (
  attributed_reseller_id IS NOT NULL
  AND has_role(auth.uid(), 'owner'::app_role, attributed_reseller_id)
);