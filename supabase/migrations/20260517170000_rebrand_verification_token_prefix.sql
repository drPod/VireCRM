-- Rebrand: flip the white-label verification token prefix from the old
-- `vireon-verify-` to `majix-verify-`. Only the column DEFAULT changes —
-- existing tokens stay as-is so any org that already published a TXT record
-- doesn't get invalidated. Verification matches by substring inclusion, so
-- the brand prefix is cosmetic; the rename is purely so newly issued tokens
-- read consistently with the rest of the UI.

ALTER TABLE public.organizations
  ALTER COLUMN domain_verification_token
  SET DEFAULT ('majix-verify-' || REPLACE(gen_random_uuid()::text, '-', ''));
