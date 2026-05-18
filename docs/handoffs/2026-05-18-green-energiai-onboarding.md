# Handoff — Green EnergiAi (Crystal Cameron) onboarding + energy-broker CRM build-out

**Started:** 2026-05-18 (Opus 4.7 1M, caveman mode)
**Status:** plan written, nothing implemented yet
**Tenant:** Green EnergiAi (energy broker, Crystal Cameron CEO) — first real customer tenant on the multi-tenant SaaS. They USE the CRM for their own pipeline. **No sub-resale** — their customers are leads/contacts inside their CRM, not separate tenants of Majix.
**Why this exists:** Crystal sent her 2yr client list (xlsx), only `Customer Name` imported. Schema gap + import-insert bug. She also wants Clients tab + Pricing tab + agent-mils workflow. Multi-step build; one agent will run out of context — handoff makes it resumable.

---

## Compact resume prompt

> Continue the Green EnergiAi onboarding + energy-broker CRM build from `docs/handoffs/2026-05-18-green-energiai-onboarding.md`. Read the handoff, jump to the **"What's done / what's next"** section, pick first unchecked step. Caveman mode. Don't re-litigate decisions in the **"Decisions locked"** section. Append progress to **"What's done / what's next"** before context fills. Verify before claiming done per CLAUDE.md.

## Continue here (handoff for next session, 2026-05-18)

**Done in session 1 (commits `30f3a54`, `e0ada67`, `554580a`):**
- Step 0 — tenant provisioned, `greenenergiai.majix.ai` renders white-label, agent-browser smoke ✓
- Step 1 — schema migration `20260518200618_energy_broker_fields.sql` applied, `commission_value` generated column math verified
- Step 2 — `ImportLeadsDialog.tsx` parses + inserts all energy fields. Typecheck + build clean. Not yet user-walked through dev server.

**Done in session 2 (commits `4635496`, `4b6f75e`, pending Step 5 commit):**
- Step 3 — AI mapper prompt + schema updated for 10 energy fields (`src/functions/import-mapping.functions.ts`). `buildLeadsFromAiMapping` reads AI energy indices first, falls back to raw-header heuristic. Typecheck + build clean.
- Step 4 — Historical backfill toggle in `ImportLeadsDialog.tsx`. Backfill on → every row inserts as `status=won` + auto-outreach disabled (UI + handler both guard). Typecheck + build clean.
- Step 5 — Pricing tab shipped at `src/routes/_app.pipeline.tsx` (URL `/pipeline`, sidebar label "Pricing"). Editable rate + mils per row, generated commission, Mark Won action. Sidebar entry added to Overview section. Typecheck + build clean.

**Pick up at Step 6** (Clients tab — leads where status='won', read-only, sort by contract_end_date ascending, supplier + expiry-window filters). Route file name: `src/routes/_app.book.tsx` (URL `/book`, sidebar label "Clients"). Reasons for `/book` instead of `/clients` in PR 5 notes — TL;DR `/clients` is the legacy reseller-mgmt page, can't collide. Mirror the Pipeline route's structure (already a known-good template), just drop the Input + Mark Won wiring and add filters. After Step 6, PR 3 boundary.

**Before opening PR 1**, run an end-to-end dev-server walk:
1. `bash scripts/restart-dev.sh` (fresh env bake — `VITE_SUPABASE_URL` is critical)
2. Sign in as Crystal — issue her a one-shot magic-link first:
   ```bash
   set -a; source .env; set +a
   curl -s -X POST "$SUPABASE_URL/auth/v1/admin/generate_link" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"type":"magiclink","email":"crystal@greenenergiai.com","options":{"redirect_to":"https://greenenergiai.majix.ai/"}}'
   ```
   That returns the action link. Don't share it with Crystal yet — it's for dev verification.
3. Open Import dialog, upload `Copy of NGP MASTER LIST - Copy.xlsx` (gitignored at repo root), confirm preview shows ESI/address/mils/cost/dates/title/deal_name columns populated.
4. Click Import. Query `SELECT name, esi_id, service_address, annual_kwh, cost_per_kwh, agent_mils, contract_start_date, contract_end_date, commission_value FROM public.leads WHERE organization_id='c31c2a18-f595-499d-9353-f3cd1d9e659b' LIMIT 5;` and confirm every column populates per row.

**Known state at handoff:**
- Crystal's user: `b5ae0c3e-1655-48d5-b211-a9fd55aaafea`, org: `c31c2a18-f595-499d-9353-f3cd1d9e659b`, slug `greenenergiai`, owner role on the org.
- Migration timestamp drift: handoff originally specced `20260518030000_*`, but `supabase migration new` stamped `20260518200618_*` (UTC at run time). Both work; the file's content matches the plan with the `age()` → date-subtraction fix.
- `bunfig.toml`, `bun.lock`, vite config — all clean post-Lovable cleanup (yesterday's session). Don't reopen.

**Open questions still queued** (don't block code progress, see "Open questions" section below):
- Logo + brand colors for Green EnergiAi (Crystal hasn't sent assets yet)
- Multi-ESI customer policy (current v1 hack: comma-separated in `esi_id text`)
- "Total contract value" interpretation lock (mils-based per Decision 4; confirm next call)

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

### Step 0 — Provision Crystal's tenant `[x]` (2026-05-18)

- [x] Created auth user `crystal@greenenergiai.com` via Auth Admin API (no email sent — temp password rotated out of session, will use magic-link in Step 8).
  - `auth.users.id` = `b5ae0c3e-1655-48d5-b211-a9fd55aaafea`
  - `email_confirm=true`, `user_metadata.full_name="Crystal Cameron"`
  - `handle_new_user` trigger auto-created org + profile + user_roles(owner) for her.
- [x] Rebranded auto-created org to Green EnergiAi:
  - `organizations.id` = `c31c2a18-f595-499d-9353-f3cd1d9e659b`
  - `name`/`brand_name` → `Green EnergiAi`
  - `slug` → `greenenergiai` (drives `greenenergiai.majix.ai` subdomain)
  - `support_email` → `crystal@greenenergiai.com`
  - `is_reseller` → `false` (default; flag is legacy)
  - `custom_domain` → null (upgrade path: `CustomDomainsPanel` later)
  - Brand theme (logo, primary/accent/sidebar colors, favicon, font) → defaults; flagged for Crystal to provide assets.
- [x] **Skipped welcome-email send.** Provisioned tenant infra only; defer the customer-facing notification to Step 8 once the import + tabs land. Intentional decoupling — no email noise while we're shipping the rest.
- [x] Verified subdomain resolves end-to-end (`get_org_by_domain('greenenergiai.majix.ai')` returns the blob; agent-browser smoke on `https://greenenergiai.majix.ai/` + `/login` shows H1 "Get started with Green EnergiAi" and tagline "Sign in to your Green EnergiAi account").
- [x] Appended to ISSUES.md `## Recent` (2026-05-18 — green-energiai step 0).

**Findings to thread forward:**
- Login path is `/login`, NOT `/auth/login` as written in Step 0 verification text — fixed inline above; downstream steps + Step 8 DM should use `https://greenenergiai.majix.ai/login`.
- White-label theme uses platform defaults until Crystal sends logo + brand colors. Not a code blocker; tracked under "Open questions".
- Doc title is SSR'd as "Majix — Never Let a Lead Go Cold Again" then client React swaps it to "Green EnergiAi" post-hydration. Acceptable; SSR title swap is a separate polish item if Crystal cares.

### Step 1 — Schema migration `[x]` (2026-05-18, migration `20260518200618_energy_broker_fields.sql`)

- [x] Created `supabase/migrations/20260518200618_energy_broker_fields.sql` (note: timestamp differs from handoff's `20260518030000_*` — `supabase migration new` stamps its own UTC; same content).
- [x] Migration adds `service_address`, `esi_id`, `title`, `deal_name`, `contract_start_date`, `cost_per_kwh`, `agent_mils`, plus the generated `commission_value` column + the two partial indexes.
- [x] Existing columns confirmed via live schema dump: `annual_kwh` (bigint), `contract_end_date` (date), `current_supplier` (text) were already on the table from an earlier migration — the only thing missing was the insert plumbing (Step 2). NOTE: the live `annual_kwh` is `bigint`, not the `integer` the handoff originally specced — bigint is the right call (multi-million kWh customers fit; integer caps at ~2.1B kWh which is also fine but bigint future-proofs). No change made.
- [x] **First push failed** with `ERROR: generation expression is not immutable (SQLSTATE 42P17)` — `age()` and `extract(year from interval)` are STABLE not IMMUTABLE under Postgres's type rules (timezone-dependent timestamp conversion). Replaced the expression with date subtraction (`(end_date - start_date)` returns integer days, fully IMMUTABLE) divided by 365 and `floor`'d for year-count. Same `coalesce(..., 1)` semantics for null/short-span contracts. Migration re-applied cleanly.
- [x] Math probe (1,000,000 kWh × 2-year contract × 3.0 mils × 0.001) → `commission_value = 6000.000000` ✓. Probe row deleted afterward.
- [x] `supabase gen types typescript --linked > src/integrations/supabase/types.ts` regenerated; CLI version-update notice had to be stripped from stdout via `head -5403`. New fields visible in types: `agent_mils`, `cost_per_kwh`, `service_address`, `esi_id`, `deal_name`, `contract_start_date`, `commission_value`.
- [x] `bun run typecheck` → clean.
- [x] ISSUES.md `## Recent` to be appended in same commit as Step 1.

~~Plan from original handoff (kept for context, see "(2026-05-18)" notes above for what actually shipped):~~

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

### Step 2 — Fix import insert + expand header dictionary `[x]` (2026-05-18)

- [x] `ParsedLead` extended with `title`, `deal_name`, `service_address`, `esi_id`, `contract_start_date`, `cost_per_kwh`, `agent_mils`.
- [x] Added 7 new header dictionaries (`ESI_HEADERS`, `ADDRESS_HEADERS`, `TITLE_HEADERS`, `DEAL_NAME_HEADERS`, `CONTRACT_START_HEADERS`, `COST_PER_KWH_HEADERS`, `MILS_HEADERS`).
- [x] Added two parsers: `parseCostPerKwh` (strips `$`, `¢`, `/kwh`; ≥1 = cents → divide by 100; <1 = dollars verbatim → snaps to numeric(8,5) precision) and `parseMils` (strips `mils`, accepts bare ints or "0.003" → 3 mils; snaps to numeric(6,3)).
- [x] Renamed `parseContractEndDate` → `parseContractDate` (same logic, reused for start date too).
- [x] `IndexMap` interface grew 7 fields; CSV path + XLSX path + AI-fallback path all find + pass the new indices.
- [x] `buildLeadsFromIndices` emits every new field; soft warnings for unparseable cost/mils/dates, never blocks the row.
- [x] **Critical fix** — insert payload now writes `title`, `deal_name`, `service_address`, `esi_id`, `annual_kwh`, `contract_start_date`, `contract_end_date`, `current_supplier`, `cost_per_kwh`, `agent_mils`. Earlier pipeline parsed these then silently dropped them at insert — that bug is what Crystal hit.
- [x] `bun run typecheck` + `bun run build` clean.

**Browser smoke test deferred** — see Step 8 + the "Continue here" note at the bottom of this doc. Reason: subagent context budget. The right test = actually upload Crystal's xlsx in `bun run dev`, sign in as Crystal (`crystal@greenenergiai.com` — magic-link issuance is Step 8), open Import dialog, confirm every column populates. That walk needs a fresh agent session.

~~Original Step 2 plan (kept for diff context):~~

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

### Step 3 — AI mapper prompt update `[x]` (2026-05-18)

- [x] `ImportColumnMapping.fields` extended with 10 energy-broker fields (`title`, `deal_name`, `service_address`, `esi_id`, `annual_kwh`, `current_supplier`, `contract_start_date`, `contract_end_date`, `cost_per_kwh`, `agent_mils`). Extracted shared `FieldSource` alias to keep the type declaration legible.
- [x] `callAiWithFallback` result type + `toolSchema` properties grew matching `<field>_source` entries (still optional / nullable; only `row_one_is_data` + `explanation` required).
- [x] System prompt now defines the energy-broker schema inline: field semantics + canonical header synonyms (ESID, Meter Number, Annual kWh, Supplier vs Source disambiguation, REP, Rate, $/kWh, Mils). Added two disambiguation rules: supplier vs lead source, company vs deal_name. Tells the AI to leave energy fields null on plain contact imports — no garbage-mapping pressure for non-energy tenants.
- [x] `resolve(...)` block in the handler returns the 10 new fields; existing positional/header parser handles them identically to standard contact fields (no behaviour change required for the resolver itself).
- [x] `ImportLeadsDialog.tsx` `buildLeadsFromAiMapping` now reads AI energy mappings first, falls back to raw-header heuristic via new `aiOrHeuristic(...)` shim. Belt-and-suspenders: AI miss on a column we can still see by name doesn't lose the data.
- [x] `bun run typecheck` clean. `bun run build` clean (6.78s, no new warnings).

**Verification debt (Step 8 walk):** real-XLSX confirmation that the AI mapper hits Crystal's headers is part of the end-to-end Step 8 dev-server walk. Until then the heuristic fallback covers her sheet — the AI mapper only fires when heuristic header detection fails to find a `name` column.

**PR 1 ready.** Steps 0-3 land together. Branch + PR description still to write.

### Step 4 — Historical backfill toggle `[x]` (2026-05-18)

- [x] New `backfillMode` state in `ImportLeadsDialog`, default off, reset on dialog close.
- [x] New `<Switch id="backfill-import">` placed ABOVE the auto-outreach switch. Label: "Import as closed clients (historical backfill)". Sublabel: "Sets every row to status 'won' and disables auto-outreach. Use when loading existing customers, not new leads."
- [x] Batch insert overrides `status: "won"` for every row when `backfillMode` is on (otherwise honours parsed status).
- [x] Auto-outreach switch goes visually disabled (muted label, `cursor-not-allowed`, sublabel swaps to "— disabled in backfill mode") + functionally disabled (`<Switch disabled>` + `checked={outreachEnabled && !backfillMode}`) when backfill is on. Underlying preference is preserved — re-enabling backfill restores the user's auto-outreach choice.
- [x] Auto-outreach trigger in `handleImport` now gates on `outreachEnabled && !backfillMode` (belt-and-suspenders — UI already prevents this, but the state machine is two-source-of-truth so guard both).
- [x] `bun run typecheck` + `bun run build` clean.

**Tested manually?** No — same Step-8 dev walk debt as Step 2/3. The unit logic is small enough to read; UX confirmation (visible disabled state, label swap, status pill in Clients tab after backfill upload) is the dev-server walk.

**PR 2 boundary reached** per handoff cadence ("PR 2 = step 4"). Could ship now or bundle with PR 3 (Pricing + Clients tabs) since the toggle is only meaningful once the Clients tab exists to display the won rows.

### Step 5 — Pricing tab `[x]` (2026-05-18)

- [x] **Routing decision:** new `_app.pipeline.tsx` (URL `/pipeline`, sidebar label "Pricing"). Couldn't reuse `/pricing` (marketing public route) or `/clients` (legacy reseller-mgmt scaffold gated `isReseller && isOwner`). `/pipeline` is universal vocabulary; the sidebar label says "Pricing" since that's Crystal's mental model. Decoupling URL from label means renames are cheap.
- [x] Direct supabase + useState pattern (matches the rest of the project, e.g. `_app.expenses.tsx`). The project doesn't standardise on TanStack Query for screens like this — followed convention rather than introducing a new abstraction (CLAUDE.md "Use existing implementations").
- [x] Sidebar entry added under Overview section in `src/components/crm/CrmSidebar.tsx`. Universal — appears for every tenant regardless of industry template.
- [x] Route fetches `leads where status='negotiation' for current org`, sorted `contract_end_date ascending nulls last` (expiring contracts first — renewal hunt for the upgrade upsell).
- [x] Columns: deal, customer, service address, ESI (monospaced), annual kWh (right-aligned tabular), supplier (Badge), contract end (locale date), editable rate, editable mils, computed commission, "Mark Won" action.
- [x] Edit-in-place via shadcn `<Input type="number">` on blur. No save-button — onBlur with diff check (skip noop saves). Per-row `savingId` / `winningId` state disables both inputs + Mark Won button during the mutation. Reload after save.
- [x] "Mark Won" → `status='won'` update + reload (row disappears, will reappear in Clients tab from Step 6).
- [x] Pipeline-commission summary chip in header sums all visible `commission_value` rows — Crystal's "total at stake right now" number.
- [x] Empty state + loading state styled per the rest of the CRM.
- [x] Dynamic-key Supabase update gotcha hit: `{ [field]: next }` failed strict typing. Fixed with explicit ternary patch (one of two columns). PR review nit later if we add more editable cols — generalize then.
- [x] `bun run typecheck` clean. `bun run build` clean (regenerated `routeTree.gen.ts` to register `/pipeline`).

**Browser verification debt:** sign in as Crystal, navigate to `/pipeline`, move a lead to negotiation status from the leads page, confirm it shows; edit rate + mils and confirm commission updates after blur; Mark Won and confirm the row disappears. Same Step 8 dev-server walk applies.

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
