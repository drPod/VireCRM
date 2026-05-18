-- Energy-broker fields on leads — supports Green EnergiAi and any other
-- broker tenant. Every deal = one leads row; energy metadata lives in-line.
--
-- annual_kwh, contract_end_date, current_supplier already exist from earlier
-- migrations (parsed-but-dropped by ImportLeadsDialog before the same-PR fix).
-- This adds: address, ESID, contact title, agent-set deal name, contract
-- start date, supplier rate, agent mils, and the generated commission column
-- whose value drives Crystal's "total contract value" view.

alter table public.leads
  add column if not exists service_address      text,
  add column if not exists esi_id               text,
  add column if not exists title                text,
  add column if not exists deal_name            text,
  add column if not exists contract_start_date  date,
  add column if not exists cost_per_kwh         numeric(8, 5)
    check (cost_per_kwh is null or cost_per_kwh >= 0),
  add column if not exists agent_mils           numeric(6, 3)
    check (agent_mils is null or agent_mils >= 0);

-- Generated commission = annual_kwh × contract_years × agent_mils × 0.001.
-- contract_years derived from start/end via (end_date - start_date) (returns
-- integer days, IMMUTABLE) divided by 365 — collapses to 1 when either date
-- is null or the span is <1 year (matches broker rule-of-thumb: any contract
-- counts as at least a full term for commission accounting). `age()` and
-- `extract(year from interval)` cast through STABLE timestamp arithmetic, so
-- Postgres rejects them in a STORED generated column — date subtraction is
-- the only fully-immutable date-diff primitive.
alter table public.leads
  add column if not exists commission_value numeric
    generated always as (
      coalesce(annual_kwh, 0)
      * coalesce(
          nullif(
            floor(((contract_end_date - contract_start_date)::numeric) / 365),
            0
          ),
          1
        )
      * coalesce(agent_mils, 0)
      * 0.001
    ) stored;

create index if not exists idx_leads_contract_end
  on public.leads (organization_id, contract_end_date)
  where contract_end_date is not null;

create index if not exists idx_leads_esi
  on public.leads (organization_id, esi_id)
  where esi_id is not null;
