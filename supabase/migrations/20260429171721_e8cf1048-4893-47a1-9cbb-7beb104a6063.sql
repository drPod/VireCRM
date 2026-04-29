
REVOKE EXECUTE ON FUNCTION public.enqueue_workflow_runs(uuid, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workflow_on_lead_created() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workflow_on_lead_status_changed() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workflow_on_message_received() FROM anon, authenticated, public;
