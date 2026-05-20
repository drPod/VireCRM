-- Rename verification token prefix: majix-verify- → virecrm-verify-.
-- Safe: zero tenants have published TXT records (0 custom hostnames on either zone).
ALTER TABLE public.organizations
  ALTER COLUMN domain_verification_token
  SET DEFAULT ('virecrm-verify-' || REPLACE(gen_random_uuid()::text, '-', ''));

UPDATE public.organizations
  SET domain_verification_token = 'virecrm-verify-' || REPLACE(gen_random_uuid()::text, '-', '')
  WHERE domain_verification_token LIKE 'majix-verify-%';
