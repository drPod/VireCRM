-- Test-DB bootstrap. Runs against a vanilla `postgres:16` service container
-- BEFORE Drizzle migrations apply. Stands up the Supabase-shaped surface that
-- migrations + RLS policies + `withTenantContext` expect:
--
--   - `authenticated`, `anon`, `service_role`, `authenticator` roles with the
--     same `BYPASSRLS` shape as a real Supabase project (only `postgres` and
--     `service_role` bypass RLS; `authenticated` does not).
--   - `auth` schema + `auth.jwt()` reading the `request.jwt.claims` GUC blob.
--   - Default table grants so `SET ROLE authenticated` queries can read the
--     domain tables that Drizzle creates after this script runs.
--
-- The bootstrap user (CI `postgres`) is a superuser, so it can `SET ROLE` to
-- any of these. Production parity is on the role/RLS axis (post-`SET ROLE`
-- behavior), not the connecting-user privilege axis — that gap is acceptable:
-- both environments end up running queries as `authenticated`, which is what
-- the RLS policies are scoped to.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN PASSWORD 'authenticator';
GRANT anon, authenticated, service_role TO authenticator;
GRANT authenticated TO postgres;

CREATE SCHEMA IF NOT EXISTS auth;

-- Stub of Supabase's `auth.jwt()` helper. Real Supabase reads the same GUC.
-- `STABLE` so the planner can hoist the call out of WHERE-clause evaluations,
-- matching the `(SELECT auth.jwt() ...)` memoization pattern used in policies.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
