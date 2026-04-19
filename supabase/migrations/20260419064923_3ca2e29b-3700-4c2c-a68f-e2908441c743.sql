-- Drop the overly broad SELECT policy that exposed invitation tokens (a secret)
-- to every authenticated member of the organization. The existing
-- "Owners can manage invitations" ALL policy already covers owner SELECT,
-- and invitees accept via the SECURITY DEFINER accept_invitation() RPC,
-- which bypasses RLS using the token they already possess.
DROP POLICY IF EXISTS "Members can view org invitations" ON public.invitations;