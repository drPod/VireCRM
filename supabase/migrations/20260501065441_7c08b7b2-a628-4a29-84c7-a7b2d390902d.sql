-- 1. Canonical default modules per industry (single source of truth in SQL,
--    mirrors src/lib/industry-templates.ts defaultModules).
CREATE OR REPLACE FUNCTION public.default_modules_for_industry(_industry text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_industry, 'general'))
    WHEN 'energy' THEN ARRAY[
      'leads','energy_loa','energy_usage','energy_pricing','energy_contracts',
      'energy_suppliers','energy_renewals','commissions','analytics'
    ]
    WHEN 'gym' THEN ARRAY[
      'leads','campaigns','conversations','tasks','analytics'
    ]
    WHEN 'solar' THEN ARRAY[
      'leads','campaigns','conversations','appointments','analytics'
    ]
    WHEN 'real_estate' THEN ARRAY[
      'leads','campaigns','conversations','appointments','analytics'
    ]
    WHEN 'insurance' THEN ARRAY[
      'leads','campaigns','conversations','appointments','analytics'
    ]
    ELSE ARRAY[
      'leads','campaigns','conversations','tasks','analytics'
    ]
  END;
$$;

-- 2. Trigger: on industry_template change, reset enabled_modules to defaults
--    UNLESS the same UPDATE explicitly provides a new enabled_modules value
--    (e.g. the onboarding wizard already sets the new defaults itself).
CREATE OR REPLACE FUNCTION public.sync_enabled_modules_on_industry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.industry_template IS DISTINCT FROM OLD.industry_template THEN
    -- Caller did not also set enabled_modules in this UPDATE → reset to defaults.
    -- We detect this by comparing to OLD.enabled_modules (or NULL → also reset).
    IF NEW.enabled_modules IS NULL
       OR NEW.enabled_modules = OLD.enabled_modules THEN
      NEW.enabled_modules := public.default_modules_for_industry(NEW.industry_template);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_sync_enabled_modules ON public.organizations;
CREATE TRIGGER organizations_sync_enabled_modules
BEFORE UPDATE OF industry_template, enabled_modules ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.sync_enabled_modules_on_industry_change();

-- 3. One-time backfill: normalize organizations that currently hold stale or
--    empty enabled_modules. Rules:
--      a. If enabled_modules is empty / NULL → set to the template's defaults.
--      b. If NONE of the current modules appear in the template's defaults
--         (pure stale data from a previous industry) → reset to defaults.
--      c. Otherwise leave alone (user may have intentionally customised).
UPDATE public.organizations o
SET enabled_modules = public.default_modules_for_industry(o.industry_template)
WHERE
  o.enabled_modules IS NULL
  OR cardinality(o.enabled_modules) = 0
  OR NOT (o.enabled_modules && public.default_modules_for_industry(o.industry_template));
