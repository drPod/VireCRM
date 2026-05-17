-- HOTFIX: re-grant EXECUTE on RLS-helper functions to `authenticated`.
--
-- Migration 20260517133315_lock_down_security_definer_funcs.sql placed
-- these in the "Server-only / trigger-only" bucket and stripped EXECUTE
-- from `authenticated`. Bucket assumption was wrong — every one of these
-- is called transitively from RLS policy bodies (USING / WITH CHECK
-- clauses) on lead, profile, role, custom-domain, subscription and
-- feature-flag tables. Postgres evaluates policy bodies as the calling
-- user, so revoking EXECUTE from `authenticated` causes every RLS-gated
-- query a signed-in client makes to fail with
--   ERROR:  42501: permission denied for function <name>
--
-- Verified live: the headless smoke account caught it on /leads
-- (AuthProvider profile fetch + lead loader both throw 42501) and on
-- /clients (`has_role` permission denied in the owner gate).
--
-- Functions touched (chosen by grep of supabase/migrations/ for policy
-- bodies — ref counts as of 2026-05-17):
--   has_role               (229 refs across policies)
--   get_user_org_id        (175 refs)
--   user_belongs_to_org    (19 refs)
--   has_active_subscription (6 refs)
--   user_has_permission    (3 refs)
--   has_feature            (3 refs)
--   user_can_access_lead   (2 refs)
--
-- These remain SECURITY DEFINER (the original lock-down didn't change
-- definer status, only the EXECUTE grant). SECURITY DEFINER + scoped
-- internal logic is the actual auth boundary — GRANT EXECUTE just
-- controls who can _call_ them at all. Stripping that grant from
-- `authenticated` broke transitive use, not the security model.
--
-- Idempotent: GRANT EXECUTE is additive; reapplying is a no-op.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (p.oid::regprocedure)::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'has_role',
        'get_user_org_id',
        'user_belongs_to_org',
        'has_active_subscription',
        'user_has_permission',
        'has_feature',
        'user_can_access_lead'
      ])
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.sig);
  END LOOP;
END $$;
