-- 1) Soft-delete column
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_deleted_at_idx ON public.leads (deleted_at);

-- 2) Hide soft-deleted leads from the normal SELECT policy
DROP POLICY IF EXISTS "View accessible leads" ON public.leads;
CREATE POLICY "View accessible leads"
ON public.leads
FOR SELECT
USING (
  deleted_at IS NULL
  AND organization_id = get_user_org_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role, organization_id)
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lead_shares ls
      WHERE ls.lead_id = leads.id AND ls.shared_with_user_id = auth.uid()
    )
  )
);

-- 3) RPC: delete_lead(lead_id, mode)
--    mode = 'soft' | 'hard'
CREATE OR REPLACE FUNCTION public.delete_lead(p_lead_id uuid, p_mode text DEFAULT 'soft')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_tasks_removed int := 0;
  v_messages_removed int := 0;
  v_conv_msgs_removed int := 0;
  v_convs_removed int := 0;
  v_appts_removed int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_owner := has_role(v_uid, 'owner'::app_role, v_lead.organization_id);
  IF NOT (v_is_owner OR v_lead.created_by = v_uid) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete this lead' USING ERRCODE = '42501';
  END IF;

  IF p_mode NOT IN ('soft', 'hard') THEN
    RAISE EXCEPTION 'Invalid delete mode: %', p_mode USING ERRCODE = '22023';
  END IF;

  IF p_mode = 'soft' THEN
    UPDATE public.leads
       SET deleted_at = now(), updated_at = now()
     WHERE id = p_lead_id;

    RETURN jsonb_build_object(
      'mode', 'soft',
      'lead_id', p_lead_id,
      'preserved', jsonb_build_object('tasks', true, 'messages', true, 'conversations', true, 'appointments', true)
    );
  END IF;

  -- hard delete: cascade related data manually
  WITH d AS (DELETE FROM public.tasks WHERE lead_id = p_lead_id RETURNING 1)
  SELECT count(*) INTO v_tasks_removed FROM d;

  WITH d AS (DELETE FROM public.messages WHERE lead_id = p_lead_id RETURNING 1)
  SELECT count(*) INTO v_messages_removed FROM d;

  WITH d AS (
    DELETE FROM public.conversation_messages
     WHERE conversation_id IN (SELECT id FROM public.conversations WHERE lead_id = p_lead_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_conv_msgs_removed FROM d;

  WITH d AS (DELETE FROM public.conversations WHERE lead_id = p_lead_id RETURNING 1)
  SELECT count(*) INTO v_convs_removed FROM d;

  WITH d AS (DELETE FROM public.appointments WHERE lead_id = p_lead_id RETURNING 1)
  SELECT count(*) INTO v_appts_removed FROM d;

  DELETE FROM public.lead_shares WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_assignees WHERE lead_id = p_lead_id;
  DELETE FROM public.leads WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'mode', 'hard',
    'lead_id', p_lead_id,
    'removed', jsonb_build_object(
      'tasks', v_tasks_removed,
      'messages', v_messages_removed,
      'conversation_messages', v_conv_msgs_removed,
      'conversations', v_convs_removed,
      'appointments', v_appts_removed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_lead(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_lead(uuid, text) TO authenticated;