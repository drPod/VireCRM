ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan = ANY (ARRAY[
    'starter'::text,
    'growth'::text,
    'professional'::text,
    'pro'::text,
    'enterprise'::text,
    'lease_starter'::text,
    'lease_pro'::text,
    'ownership'::text,
    'custom'::text
  ]));