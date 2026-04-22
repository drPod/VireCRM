-- Add three energy-broker fields to the leads table.
-- All nullable so existing rows and existing insert flows keep working.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS annual_kwh BIGINT,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS current_supplier TEXT;

-- Soft validation: kWh shouldn't be negative.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_annual_kwh_nonneg_chk;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_annual_kwh_nonneg_chk
  CHECK (annual_kwh IS NULL OR annual_kwh >= 0);

-- Helpful indexes for filtering / sorting on these new fields.
CREATE INDEX IF NOT EXISTS leads_contract_end_date_idx
  ON public.leads (organization_id, contract_end_date);

CREATE INDEX IF NOT EXISTS leads_current_supplier_idx
  ON public.leads (organization_id, lower(current_supplier));