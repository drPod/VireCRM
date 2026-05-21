-- payout_line_items FK to reseller_payouts was dropped by CASCADE in 20260521000000,
-- but the table itself was not dropped. Drop it now.
DROP TABLE IF EXISTS public.payout_line_items;

-- organizations.commission_rate was a reseller earnings rate; not caught by prior migration.
ALTER TABLE public.organizations DROP COLUMN IF EXISTS commission_rate;
