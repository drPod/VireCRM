-- Lock the multi-vertical industry_template abstraction down to energy-only.
-- Context: Lovable scaffold left 6 vertical templates
-- (general / energy / gym / solar / real_estate / insurance); only energy is a
-- real product. UI and routes for the others are removed in sibling PRs.
-- This migration flips every existing org to 'energy' + narrows the CHECK
-- constraint to enforce single-vertical going forward. Adding another vertical
-- later = relax the constraint.
--
-- Companion application-layer changes (sibling PRs in coordinator batch
-- 2026-05-22):
--   - Unit 1: deleted 9 non-energy route files
--   - Unit 2: narrowed IndustryKey TS type, removed sidebar entries + lock
--             logic, stripped onboarding picker, swapped industry-switching
--             E2E for energy smoke
--   - Unit 3: removed VerticalsStrip from /features
--   - Unit 5: doc updates

BEGIN;

-- 1. Flip every existing org to energy. The CHECK constraint added below
--    would otherwise reject any row still holding 'general' / 'gym' / 'solar'
--    / 'real_estate' / 'insurance'.
--
--    Side effect: the AFTER UPDATE trigger `log_template_change` will write
--    one audit row per flipped org (no auth.uid() in migration context, so
--    `source` ends up tagged 'direct_update' with a null actor). Intentional
--    — preserves provenance of the lockdown.
UPDATE public.organizations
   SET industry_template = 'energy'
 WHERE industry_template IS DISTINCT FROM 'energy';

-- 2. Replace the old multi-vertical CHECK with energy-only.
--    Existing constraint named `organizations_industry_template_check` per
--    migration 20260429073749 (Postgres default name from initial ADD
--    CONSTRAINT).
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_industry_template_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_industry_template_check
  CHECK (industry_template = 'energy');

-- 3. Update default for future orgs so freshly-inserted rows satisfy the
--    new constraint without the caller having to set the column explicitly.
ALTER TABLE public.organizations
  ALTER COLUMN industry_template SET DEFAULT 'energy';

-- 4. Simplify `default_modules_for_industry` SQL fn — strip every branch
--    except energy. Existing fn lives in migration 20260501065441 with
--    signature `(_industry text) RETURNS text[] LANGUAGE sql IMMUTABLE
--    SET search_path = public`. Mirrors EXACTLY (param name `_industry`,
--    search_path, immutability) so the existing trigger
--    `organizations_sync_enabled_modules` keeps calling the right overload.
--
--    The argument is now ignored — input can only ever be 'energy' under the
--    new CHECK constraint — but we keep the signature so the trigger doesn't
--    need re-wiring and any client-side callers continue to compile.
CREATE OR REPLACE FUNCTION public.default_modules_for_industry(_industry text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'leads',
    'energy_loa',
    'energy_usage',
    'energy_pricing',
    'energy_contracts',
    'energy_suppliers',
    'energy_renewals',
    'commissions',
    'analytics'
  ]::text[];
$$;

-- 5. The `guard_industry_template_change` BEFORE trigger is now redundant —
--    the CHECK constraint enforces the only legal value, so no role-gating
--    is needed (any non-energy UPDATE fails at the constraint layer with
--    `check_violation` regardless of caller). Drop the trigger + fn.
--
--    Trigger + fn names confirmed via migrations 20260501072900 (original),
--    20260517133315 (locked-down grants), 20260517150107 (latest definition
--    permitting org-owner changes). All three reference the same names.
--
--    The AFTER trigger `log_template_change` STAYS — it short-circuits when
--    NEW.industry_template IS NOT DISTINCT FROM OLD, so it becomes a
--    no-op now that the value never changes, but cheaper to leave than rip
--    + re-add later. Same reasoning for the
--    `organizations_sync_enabled_modules` trigger.
DROP TRIGGER IF EXISTS guard_industry_template_change ON public.organizations;
DROP FUNCTION IF EXISTS public.guard_industry_template_change();

COMMIT;
