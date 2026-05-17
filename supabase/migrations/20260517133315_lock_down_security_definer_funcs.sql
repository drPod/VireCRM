-- Lock down SECURITY DEFINER funcs per RPC caller audit (2026-05-17).
-- Uses pg_proc.oid::regprocedure to handle overloaded signatures correctly.

-- ============================================================
-- 🟢 Anon-callable (signup, reseller pages, domain provider)
-- Strip PUBLIC default, explicit GRANT to anon + authenticated.
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (p.oid::regprocedure)::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'get_org_by_domain',
        'get_reseller_branding',
        'get_reseller_plan_public',
        'list_reseller_plans_public',
        'signup_under_reseller',
        'accept_invitation'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO anon, authenticated;', r.sig);
  END LOOP;
END $$;

-- ============================================================
-- 🟡 Authenticated-only (admin panel, white-label, leads, payouts)
-- Revoke anon + PUBLIC, grant authenticated only.
-- log_custom_domain_event added here (real client callsite at CustomDomainsPanel.tsx:48).
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (p.oid::regprocedure)::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'admin_financial_overview',
        'admin_list_organizations',
        'admin_list_template_audit',
        'admin_org_billing',
        'admin_set_org_plan',
        'admin_set_org_plan_by_email',
        'admin_submission_payment_history',
        'admin_set_org_industry',
        'admin_list_platform_admins',
        'grant_platform_admin_by_email',
        'revoke_platform_admin',
        'is_platform_admin',
        'org_has_active_subscription',
        'get_reseller_clients',
        'mark_payout_paid',
        'mark_earning_paid',
        'mark_domain_verified',
        'add_custom_domain',
        'remove_custom_domain',
        'set_primary_custom_domain',
        'mark_custom_domain_verified',
        'log_custom_domain_event',
        'share_lead',
        'unshare_lead',
        'delete_lead',
        'assign_custom_role',
        'remove_org_member'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated;', r.sig);
  END LOOP;
END $$;

-- ============================================================
-- 🔴 Server-only / trigger-only
-- Revoke from everyone. Service role bypasses (used by edge funcs + server routes).
-- Trigger funcs execute under definer context, not granted role.
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (p.oid::regprocedure)::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'log_admin_quote_event',
        'webhook_grant_plan_by_email',
        'grant_credit_pack',
        'apply_credit_plan',
        'consume_credit',
        'consume_platform_lead_quota',
        'check_and_mark_low_balance',
        'get_credit_usage',
        'get_pack_credit_balance',
        'calculate_reseller_payouts',
        'update_member_role',
        'user_has_permission',
        'has_role',
        'seed_builtin_roles_for_org',
        'handle_new_user',
        'handle_lead_won',
        'delete_email',
        'enforce_custom_domain_entitlement',
        'enqueue_email',
        'read_email_batch',
        'move_to_dlq',
        'purge_advisor_audit_log',
        'get_user_org_id',
        'get_lead_usage',
        'has_active_subscription',
        'has_feature',
        'user_belongs_to_org',
        'user_can_access_lead',
        'touch_updated_at',
        'guard_industry_template_change',
        'log_template_change',
        'enforce_lead_assignment_role',
        'stop_sequences_on_meeting',
        'stop_sequences_on_reply',
        'increment_ai_tokens'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC;', r.sig);
  END LOOP;
END $$;
