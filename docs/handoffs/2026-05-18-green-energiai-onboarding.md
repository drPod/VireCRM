# Handoff — Green EnergiAi (Crystal Cameron) onboarding + energy-broker CRM build-out

**Started:** 2026-05-18 (Opus 4.7 1M, caveman mode)
**Status:** plan written, nothing implemented yet
**Tenant:** Green EnergiAi (energy broker, Crystal Cameron CEO) — first real customer tenant on the multi-tenant SaaS. They USE the CRM for their own pipeline. **No sub-resale** — their customers are leads/contacts inside their CRM, not separate tenants of Majix.
**Why this exists:** Crystal sent her 2yr client list (xlsx), only `Customer Name` imported. Schema gap + import-insert bug. She also wants Clients tab + Pricing tab + agent-mils workflow. Multi-step build; one agent will run out of context — handoff makes it resumable.

---

## Compact resume prompt

> Continue the Green EnergiAi onboarding + energy-broker CRM build from `docs/handoffs/2026-05-18-green-energiai-onboarding.md`. Read the handoff, jump to the **"What's done / what's next"** section, pick first unchecked step. Caveman mode. Don't re-litigate decisions in the **"Decisions locked"** section. Append progress to **"What's done / what's next"** before context fills. Verify before claiming done per CLAUDE.md.

---

## Customer context

- **Person:** Crystal Cameron, CEO, Green EnergiAi
- **Email:** `crystal@greenenergiai.com`
- **Phone:** 940.365.4479
- **Website:** www.greenenergiAi.com
- **Business:** Texas energy broker. Resells electricity contracts to commercial customers. Earns commission via **agent mils** added on top of supplier rate.
- **Data scale:** ~2 years of closed deals on master spreadsheet (xlsx in repo root, gitignored as `Copy of NGP MASTER LIST - Copy.xlsx`). Each row = one customer/contract with ESI meter number(s), service address, supplier, contract dates, rate, mils.
- **CRM tier:** direct tenant on the SaaS. Free tier = `greenenergiai.majix.ai` subdomain. Can upgrade to custom hostname later via existing CF for SaaS flow. **No reseller layer exists in the product** — Crystal is a customer of Majix, full stop.

---

## Verbatim email from Crystal (2026-05-18 ~1:33 PM)

> Hi Darsh,
>
> It was great to speak with you.  Please see attached list.   I have already uploaded this list but the only thing that uploaded was the customer name and no other information from this list.
>
> It is important that the Deal Name, addresses, ESI numbers, Customer Name, Title, Phone, Email, Annual Usage  and mils, all upload as well so we do not have to go back in and manually input all of this information.
> The Esi number is the meter numbers on this list that starts with mostly 1044.........    For every address there is an ESI number which is what we need to show and is very important in our business.    Also, lastly it needs to show the "Supplier",  "Contract Start Date", and "Contract End Date" and "Cost per Kwh".
>
> All of these fields are on the list I just attached as well.
>
> Please let me know if you have any questions.
>
> Thanks so much and I look forward to building with you.
>
> Make it a great day.
>
> With Energy & Abundance,
>
> Crystal Cameron
> CEO| Green EnergiAi
> 940.365.4479
> crystal@greenenergiAi.com
> www.greenenergiAi.com

Attachment: `Copy of NGP MASTER LIST - Copy.xlsx` (2.2MB, gitignored).

---

## Verbatim call notes (2026-05-18)

> Needs a tab that says "current clients"
>
> In the CRM, there's stages. When you get to stage 1 and the deal is won, then the customer feeds into this new tab.
>
> She has two years of clients that she needs to feed into the system.
>
> When they close the deal, there needs to show "agent mils" - this is a number the agents will put that tells us how much money they're making - that's how the total contract value is calculated.
>    this as well:
> In pricing, the deal that communicates to the in pricing tab (in the stage before the deal is won and closed)

---

## Required fields from Crystal's email (the source of truth)

| Field | Type | Notes |
|---|---|---|
| Deal Name | text | per-row label, agent-set |
| Service address | text | physical address of metered location |
| ESI number | text | Texas ESID, mostly starts with `1044…`. Multiple per customer possible (1 per address) |
| Customer Name | text | contact person at customer org |
| Title | text | their job title |
| Phone | text | exists in schema |
| Email | text | exists in schema |
| Annual Usage (kWh) | int | exists in `ImportLeadsDialog` parser, missing from insert |
| Mils (agent_mils) | numeric(6,3) | broker commission rate, $0.001/kWh units. **Drives total contract value.** |
| Supplier | text | parsed by `ImportLeadsDialog`, missing from insert |
| Contract Start Date | date | new — not in parser |
| Contract End Date | date | parsed by `ImportLeadsDialog`, missing from insert |
| Cost per kWh | numeric(8,5) | supplier rate; new |

---

## Decisions locked (don't re-litigate)

1. **Keep `leads` table as the deal entity.** Every deal = one `leads` row. Status enum already covers pipeline stages. No need for separate `deals` / `contacts` / `accounts` tables for v1 — Crystal's workflow fits "lead with energy metadata" cleanly.
2. **Stage enum unchanged in DB**, renamed in UI: `negotiation` → "Pricing" (Pricing tab), `won` → "Client" (Clients tab). Avoids migration risk + downstream code already keyed off enum values.
3. **ESI is single-string for v1** (multi-meter customers later). Stuff into `leads.esi_id`. If a customer has 3 ESIDs, agent puts them comma-separated for now. Real meter-per-row table = future work, not Crystal-blocking.
4. **Agent mils math (broker commission, what Crystal calls "total contract value"):**
   ```
   commission_value = annual_kwh × contract_years × agent_mils × 0.001
   ```
   Where `contract_years` = years between `contract_start_date` and `contract_end_date`. Implement as PG generated column so it stays in sync.
5. **Tenant model:** Green EnergiAi is a direct tenant of Majix (`is_reseller=false`, which is the only valid value for real customers right now — the `is_reseller` flag is legacy Lovable scaffold). Free tier = `greenenergiai.majix.ai` subdomain auto-provisioned at signup. Upgrade to custom hostname (e.g. `crm.greenenergiai.com`) later via existing CF for SaaS flow if she wants.
6. **Import path is fix-the-existing dialog**, not write a new one. `ImportLeadsDialog` already parses some energy fields — bug is they're dropped at insert (`src/components/crm/ImportLeadsDialog.tsx:675-686`). Extend the existing component.
7. **"Stage 1"** in call notes = won (closed). Confirmed by "When you get to stage 1 and the deal is won, then the customer feeds into this new tab." (won → Clients tab.)
8. **Historical backfill via re-upload toggle.** Add "Import as closed clients" switch in `ImportLeadsDialog` that sets `status=won` instead of `new`. Crystal re-uploads the master list once schema + insert is fixed.

---

## Skills to invoke (per step)

Project has these skills installed (see `skills-lock.json` + `.agents/skills/`):

- `tanstack-start-best-practices`
- `tanstack-router-best-practices`
- `tanstack-query-best-practices`
- `tanstack-integration-best-practices`
- `email-best-practices`, `react-email`, `resend`
- `workers-best-practices`, `wrangler`
- `stripe-best-practices`, `stripe-projects`, `upgrade-stripe`
- (from plugins, auto-loaded) `supabase`, `shadcn`, `vercel`, `web-design-guidelines`, `ui-ux-pro-max`

**Skill → step mapping:**

| Step | Skills to invoke before starting |
|---|---|
| 0. Provision Crystal's tenant | `supabase` (RLS check + invitations table), `resend` (welcome email through existing infra) |
| 1. Schema migration | `supabase` (migrations, generated columns, RLS) |
| 2. Fix import insert + expand headers | (none specific — surgical edit) |
| 3. AI mapper prompt update for energy fields | (none) |
| 4. Historical backfill toggle | `tanstack-query-best-practices` (mutation invalidation) |
| 5. Pricing tab route + UI | `tanstack-router-best-practices` (file-route), `tanstack-query-best-practices` (suspenseful query), `shadcn` (table + dialog), `web-design-guidelines` (a11y pass) |
| 6. Clients tab route + UI | same as 5 |
| 7. Renewal cron | `supabase` (pg_cron via SQL migration — see `supabase/migrations/20260517*.sql` patterns) |
| 8. Browser verification | `~/.claude/rules/browser.md` (agent-browser CLI first, AXTree mode, subagent dispatch) |

**Skill invocation:** at the start of each step, the implementing agent must `Skill` tool the relevant skill (or `Skill` tool the project ui-ux-pro-max gate if greenfield UI). Don't freelance.

---

## What's done / what's next

Format: each item has `[ ]` (pending) → `[~]` (in progress) → `[x]` (done, with commit sha). Append findings under the item as bullets. Don't delete past notes — future agents read them.

### Step 0 — Provision Crystal's tenant `[ ]`

- [ ] Create org row for Green EnergiAi via Supabase CLI (or use the direct-signup flow at `https://majix.ai/signup` if it's wired end-to-end; verify slug persistence per ISSUES.md `## Open` hostname-rollout item before relying on it)
  - `name`: `Green EnergiAi`
  - `is_reseller`: `false` (every real customer is `false`; flag is legacy Lovable)
  - `slug`: `greenenergiai` (used for `greenenergiai.majix.ai` subdomain)
  - `custom_domain`: null for v0 (she can upgrade later via `CustomDomainsPanel`)
  - white-label theme: defaults OK for v0; ask her for logo/brand colors as separate task
- [ ] Invite Crystal as admin to org → triggers existing welcome email infra (`pending_welcome_emails` → Resend)
- [ ] Verify subdomain resolves: `https://greenenergiai.majix.ai/auth/login` should render white-label login
- [ ] Append result to ISSUES.md `## Recent`

**Verification:** open `https://greenenergiai.majix.ai` in agent-browser (headed if testing OAuth, headless otherwise), confirm `DomainBrandingProvider` resolves the org, login page shows Green EnergiAi branding (or fallback Majix branding if no theme set).

**Risk:** wildcard `*.majix.ai` DNS still pending per `CLAUDE.md` hostname plan. If subdomain doesn't resolve, that's the blocker — escalate to ISSUES.md `## Open`, fall back to `app.majix.ai` invite + Crystal navigates manually.

### Step 1 — Schema migration `[ ]`

- [ ] Create `supabase/migrations/20260518030000_energy_broker_fields.sql`:

```sql
-- Energy broker fields on leads
alter table public.leads add column if not exists service_address text;
alter table public.leads add column if not exists esi_id text;             -- Texas ESID; comma-separated for multi-meter customers (v1 hack)
alter table public.leads add column if not exists title text;              -- contact title at customer
alter table public.leads add column if not exists deal_name text;
alter table public.leads add column if not exists annual_kwh integer check (annual_kwh is null or annual_kwh >= 0);
alter table public.leads add column if not exists current_supplier text;
alter table public.leads add column if not exists contract_start_date date;
alter table public.leads add column if not exists contract_end_date date;
alter table public.leads add column if not exists cost_per_kwh numeric(8,5) check (cost_per_kwh is null or cost_per_kwh >= 0);
alter table public.leads add column if not exists agent_mils numeric(6,3) check (agent_mils is null or agent_mils >= 0);

-- Generated commission = annual_kwh × contract_years × agent_mils × 0.001
-- contract_years derived from start/end dates, defaults to 1 if either is null
alter table public.leads add column if not exists commission_value numeric
  generated always as (
    coalesce(annual_kwh, 0)
    * coalesce(
        nullif(extract(year from age(contract_end_date, contract_start_date)), 0),
        1
      )
    * coalesce(agent_mils, 0)
    * 0.001
  ) stored;

-- Renewal lookup: contracts expiring soon
create index if not exists idx_leads_contract_end on public.leads(organization_id, contract_end_date) where contract_end_date is not null;
create index if not exists idx_leads_esi on public.leads(organization_id, esi_id) where esi_id is not null;
```

- [ ] Apply via `supabase db push` (or MCP `apply_migration` if CLI unavailable)
- [ ] Regenerate types: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`
- [ ] Typecheck (`bun run typecheck`) — fix any `leads`-table consumers that broke
- [ ] Append result to ISSUES.md `## Recent` with commit sha + migration file

**Gotchas:**
- Stored generated column needs all input columns immutable to `commission_value`. `age()` is immutable in PG ≥14. Supabase runs 15, safe.
- Existing rows get `commission_value = 0` (all inputs null → coalesce zeros). Fine.
- RLS already filters by `organization_id` on `leads` — no extra policy needed.

### Step 2 — Fix import insert + expand header dictionary `[ ]`

File: `src/components/crm/ImportLeadsDialog.tsx`

- [ ] Expand `ParsedLead` interface with new fields: `service_address`, `esi_id`, `title`, `deal_name`, `contract_start_date`, `cost_per_kwh`, `agent_mils`
- [ ] Add header dictionaries:
  ```ts
  const ESI_HEADERS = ["esi", "esi id", "esi number", "esid", "meter", "meter number", "meter #"];
  const ADDRESS_HEADERS = ["address", "service address", "premises address", "site address", "location"];
  const TITLE_HEADERS = ["title", "job title", "role", "position"];
  const DEAL_NAME_HEADERS = ["deal name", "deal", "opportunity", "opportunity name"];
  const CONTRACT_START_HEADERS = ["contract start", "contract start date", "start date", "effective date", "csd"];
  const COST_PER_KWH_HEADERS = ["cost per kwh", "rate", "supplier rate", "cost/kwh", "price per kwh", "$/kwh", "cost"];
  const MILS_HEADERS = ["mils", "agent mils", "broker mils", "margin", "spread"];
  ```
- [ ] Add parsers: `parseCostPerKwh(raw)` (strip `$`, handle commas), `parseMils(raw)` (numeric, allow decimals)
- [ ] Wire all new indices into `buildLeadsFromIndices` + `buildLeadsFromAiMapping`
- [ ] **Critical fix** — insert at line 675-686 currently drops parsed energy fields. Add to batch:
  ```ts
  const batch = parsed.slice(i, i + BATCH_SIZE).map((l) => ({
    organization_id: organization.id,
    created_by: user.id,
    name: l.name.slice(0, 200),
    email: l.email?.slice(0, 255) || null,
    phone: l.phone?.slice(0, 50) || null,
    company: l.company?.slice(0, 200) || null,
    status: l.status || "new",
    score: l.score ?? 50,
    notes: l.notes?.slice(0, 2000) || null,
    source: l.source || "csv_import",
    // Energy fields
    deal_name: l.deal_name?.slice(0, 200) || null,
    service_address: l.service_address?.slice(0, 500) || null,
    esi_id: l.esi_id?.slice(0, 200) || null,
    title: l.title?.slice(0, 100) || null,
    annual_kwh: l.annual_kwh ?? null,
    current_supplier: l.current_supplier?.slice(0, 200) || null,
    contract_start_date: l.contract_start_date || null,
    contract_end_date: l.contract_end_date || null,
    cost_per_kwh: l.cost_per_kwh ?? null,
    agent_mils: l.agent_mils ?? null,
  }));
  ```
- [ ] Append commit sha to ISSUES.md `## Recent`

**Verification:** drop Crystal's xlsx into the import dialog in dev (`bun run dev`, login as Crystal's user, navigate to leads, open Import). Confirm preview shows all energy fields. After import, query `select * from leads where organization_id = '<crystal-org-id>' limit 5;` — every column should populate.

### Step 3 — AI mapper prompt update `[ ]`

File: `src/functions/import-mapping.functions.ts`

- [ ] Read current AI mapper system prompt
- [ ] Add the new canonical field names (`deal_name`, `esi_id`, `service_address`, `title`, `annual_kwh`, `current_supplier`, `contract_start_date`, `contract_end_date`, `cost_per_kwh`, `agent_mils`) to the mapper schema
- [ ] Include examples from energy domain ("ESID" → `esi_id`, "Rate" → `cost_per_kwh`, "Mils" → `agent_mils`)
- [ ] Verify with a deliberately mis-headered xlsx (e.g. headers shifted, abbreviated)

### Step 4 — Historical backfill toggle `[ ]`

File: `src/components/crm/ImportLeadsDialog.tsx`

- [ ] Add `<Switch>` under the auto-outreach toggle labeled "Import as closed clients (historical backfill)"
- [ ] When on, sets `status: "won"` on every row in the batch (overriding parsed status)
- [ ] Disables auto-outreach toggle when historical mode on (don't email old clients)
- [ ] Crystal re-uploads her master list with this switch ON → all 2yrs of deals land as `status=won` → show up in Clients tab once that's built

### Step 5 — Pricing tab `[ ]`

New route: `src/routes/_authed/crm/pricing.tsx` (or wherever existing CRM routes live; check `src/routes/_authed/crm/`)

- [ ] Invoke `Skill` → `tanstack-router-best-practices` before writing
- [ ] Invoke `Skill` → `tanstack-query-best-practices` for data fetching pattern
- [ ] Invoke `Skill` → `shadcn` for table primitives
- [ ] Add sidebar nav entry in `src/components/crm/CrmSidebar.tsx`: "Pricing"
- [ ] Route fetches `leads` where `status='negotiation'` for current org, RLS handles isolation
- [ ] Columns: `deal_name`, customer `name`, `service_address`, `esi_id`, `annual_kwh`, `current_supplier`, `contract_end_date` (existing contract expiring), **editable `cost_per_kwh`**, **editable `agent_mils`**, computed `commission_value` (read-only, from generated column)
- [ ] Edit-in-place via shadcn `<Input>` + Supabase update + Query invalidation
- [ ] Per-row "Mark Won" button → `status='won'` → row disappears from Pricing tab, appears in Clients tab
- [ ] Verify in browser (agent-browser, headed, sign in as Crystal)

### Step 6 — Clients tab `[ ]`

New route: `src/routes/_authed/crm/clients.tsx`

- [ ] Same skill invocations as step 5
- [ ] Sidebar nav: "Clients"
- [ ] Route fetches `leads` where `status='won'` for current org
- [ ] Columns: same as Pricing tab BUT all read-only after close
- [ ] Filters: by `current_supplier`, by contract expiry window (90/60/30 days — renewal hunt)
- [ ] Sort by `contract_end_date` ascending = renewal worklist
- [ ] Verify in browser

### Step 7 — Renewal cron (nice-to-have, not Crystal-blocking) `[ ]`

- [ ] Migration: `supabase/migrations/20260518040000_renewal_notification_cron.sql`
- [ ] pg_cron daily job: find leads where `contract_end_date` between `now()` and `now() + 90 days` AND `status='won'`, write to `pending_welcome_emails` (or new `pending_renewal_emails` table) for Resend pickup
- [ ] Pattern: copy from `supabase/migrations/20260517230000_schedule_remaining_phase1_crons.sql`
- [ ] Append cron name to ISSUES.md cron registry

### Step 8 — Crystal does the backfill `[ ]`

- [ ] DM Crystal: tenant ready, login at `https://greenenergiai.majix.ai`, import dialog now has all fields + historical-mode toggle
- [ ] Ask her to flip the toggle + re-upload her master list
- [ ] Verify Clients tab populates with her ~2yr of deals
- [ ] Confirm `commission_value` shows real numbers (her total earnings to date)

---

## ISSUES.md sync

Whoever lands each step:

1. Read `ISSUES.md` `## Open` at session start (per CLAUDE.md non-negotiable rule)
2. Append finding/result under `## Recent` with date + commit sha + brief
3. Tag inline `[green-energiai]` for grep-ability later
4. Cold-archive resolved items >14 days old to `docs/issues-archive/2026-05.md`

---

## Open questions (escalate to Darsh)

1. **White-label branding for Green EnergiAi** — logo file, primary/accent colors? v0 = Majix defaults, but she'll want her own. (Visual asset blocker, not code blocker.)
2. **Multi-ESI customers** — does any customer in her sheet have multiple ESIDs? If so, the comma-separated `esi_id text` v1 hack works for display but breaks per-meter analytics. Real fix = `meters` table FK to `leads`. Defer until she asks.
3. **Custom hostname** vs `greenenergiai.majix.ai` — she's launching on free tier (subdomain) per my read. Confirm.
4. **"Total contract value" interpretation** — locked-in as broker commission (mils-based). If Crystal actually means customer-side total spend (`annual_kwh × years × cost_per_kwh`), generated column formula needs to change. Worth confirming on next call.

---

## Don't do (anti-patterns for next agent)

- ❌ **Don't write a separate `deals` / `contacts` / `meters` table for v1.** Leads-as-deals model fits her workflow. Schema sprawl now = refactor pain later, no value to Crystal today.
- ❌ **Don't change the `leads.status` enum.** Just rename in UI. Existing code reads these literal strings everywhere.
- ❌ **Don't gate Crystal on perfect UI.** Step 0-4 unblocks her data; steps 5-6 are polish. Ship in two PRs if helpful.
- ❌ **Don't commit the xlsx.** Gitignored as `*.xlsx`. If you see it staged, unstage immediately.
- ❌ **Don't import via MCP Supabase tools** — use Supabase CLI per CLAUDE.md. `supabase db push` for migrations, `supabase gen types` for types.
- ❌ **Don't dispatch parallel subagents to write UI files** — shared visual decisions, they'll conflict. Single agent writes Pricing + Clients tabs.

---

## File / commit cadence

Per CLAUDE.md (project) + global rules:

- **Commit autonomously** at logical landing points (each step = one commit, conventional commit message)
- **One PR per phase:**
  - PR 1: steps 0-3 (tenant + schema + import fix)
  - PR 2: step 4 (backfill toggle)
  - PR 3: steps 5-6 (Pricing + Clients tabs)
  - PR 4: step 7 (renewal cron) — optional, can ship later
- **PR review-bot polling** per `~/.claude/rules/docs.md` — dispatch background subagent after `gh pr create`
- **Push only after** Darsh confirms + Crystal has been told to expect downtime (none expected, additive changes only)

---

## Verification checklist (run before claiming any step done)

- [ ] `bun run typecheck` clean
- [ ] `bun run lint` clean (or warnings explained)
- [ ] If UI step: agent-browser screenshot + visible page render (no console errors)
- [ ] If migration: ran on linked Supabase project successfully + types regenerated + grep confirms no broken `leads` consumers
- [ ] If import step: actual upload of Crystal's xlsx (or a redacted slice) in dev, query the DB, see all fields populated
- [ ] ISSUES.md `## Recent` appended with commit sha
- [ ] Commit pushed to feature branch (not main)

---

## Glossary (for non-energy-domain agents)

- **ESI / ESID**: Electric Service Identifier. 17-digit number that uniquely identifies a metered service point in Texas. Mostly starts with `1044` (Oncor) in Crystal's data. Critical for energy contracts.
- **Mils**: thousandths of a dollar. `1 mil = $0.001`. Agent-set adder on top of supplier rate. `3 mils on 1,000,000 kWh = $3,000 commission`.
- **Cost per kWh**: the supplier's wholesale-ish rate, e.g. `$0.085/kWh`. Customer pays `cost_per_kwh + agent_mils × 0.001` per kWh.
- **Annual usage (kWh)**: how much electricity the metered location consumes per year. Drives both supplier pricing AND commission math.
- **Contract start/end**: term of the energy supply contract. Renewals are the broker's recurring revenue moment — 90 days out is the canonical "start dialing" window.
- **Supplier**: the energy retailer (e.g. TXU, Reliant, Constellation, Direct Energy). Broker introduces customer to supplier, earns mils on every kWh consumed during the term.
- **NGP**: likely "National Gas & Power" or similar — the source of Crystal's master list. Not a CRM concept.
