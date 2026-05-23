# 01 — Data backend

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

## 1. Verdict

**`change` — Supabase Postgres day 1. Drop Airtable.**

"Airtable v1, migrate at customer 10-20" trades ~3-5 days of head start for a guaranteed forced migration during paid growth, plus lock-in on linked-records and formulas that don't transfer cleanly. Schema is already authored (8 tables, ~5,500 starting rows). The claimed Airtable savings (Kanban, formulas, import) are hours-to-days on Postgres given Atomic CRM (MIT, ships Supabase + shadcn + Kanban) and shadcn-dnd-kit templates. Migration cost later > build cost now.

## 2. Decision being vetted

Verbatim from agent files:

- `README.md:85` — "Decision: **Airtable-as-backend for v1, migrate to Supabase Postgres at customer 10-20 (or first scaling pain).** Speed-to-first-customer wins over architectural purity. Reversible by design."
- `README.md:87-93` — architecture diagram: `SPA → CF Worker → Airtable API`, one base per customer, single service PAT held by Worker.
- `CLAUDE.md` §Architecture — "Airtable = data backend. One base per tenant. Workspace `wspBUTSYGFioquhDD`." + rejected "Pure Supabase from day one — right destination, wrong start. Airtable formulas + Kanban + import save weeks."
- `TASKS.md:20-35` — Phase 1 creates Airtable base, tables, formula fields (TCV, Term Months), linked records, single-selects.
- `HANDOFF.md:23-24` — "Backend: Airtable now, Postgres at customer 10-20."

## 3. Evidence

### 3.1 Airtable hard limits at the planned scale

- **50,000 records/base on Team plan ($20/seat/mo), 125,000 on Business ($45/seat/mo).** Per-base, not per-table. Adding record 50,001 forces immediate Team→Business upgrade.
  Source: [Airtable Plans (support.airtable.com, updated 2026-05-20)](https://support.airtable.com/docs/airtable-plans), [Servalian — 50K Record Wall](https://servalian.com/blog/airtable-record-limits).
- **API rate limit 5 req/sec per base, 50 req/sec per service-account token, hard.** 429 + 30-second backoff on breach. Documented as unchanged in 2026.
  Source: [Airtable API Rate Limits](https://airtable.com/developers/web/api/rate-limits).
- **Monthly API call cap on Team plan: 100,000 calls/workspace/month** (Business + Enterprise: unlimited).
  Source: [Airtable Plans](https://support.airtable.com/docs/airtable-plans).
- **Performance degrades around 20,000 records per base** — slow lookups/formulas, integration failures, automation instability.
  Source: [Servalian — 50K Record Wall](https://servalian.com/blog/airtable-record-limits) ("warning signs around 20,000 records, especially with lookup fields and formulas").

**Applied to this project:** master sheet = 5,446 rows × 83 columns today, which after schema normalization (Customers, Service Addresses, ESIs, Contracts, Deals, LOAs, Commission Statements, Agents) means ~15-25k records on day 1 *per base* — already inside the performance-degradation zone. With 12 months of email/activity sync, multi-meter accounts, and commission statements, customer #1 alone plausibly crosses 50k on Team within year 1. One-base-per-tenant doesn't help — each customer pays the same limits.

### 3.2 Linked records + formulas don't migrate clean

- Airtable Linked Records aren't true foreign keys. A community developer trying to move ~6 cross-referenced tables to Postgres reported: "converting Airtable's 'Linked Records' into proper foreign key relationships in PostgreSQL turned out to be way more complicated than expected."
  Source: [Latenode community migration write-up](https://community.latenode.com/t/abandoned-my-custom-migration-script-for-moving-from-airtable-to-supabase-no-regrets-about-this-choice/28785).
- Formula, rollup, lookup fields sync 1-way as static values when piped to Postgres — the *logic* doesn't transfer, only the cached value. A renewal-day formula or TCV formula doesn't recompute on the Postgres side until reauthored as a generated column or app-layer derive.
  Source: [Supabase Airtable wrapper docs](https://supabase.com/docs/guides/database/extensions/wrappers/airtable) (computed fields sync as values only).

**Applied:** our `TCV` and `Term Months` formulas (`TASKS.md:29`) and the planned renewal-radar derives (`TASKS.md:67`) become rewrite work on migration, not auto-translate. The "migration = swap one module" claim in `CLAUDE.md` is optimistic by ~1-2 weeks of formula rewrites + linked-record FK normalization + LOA/Commission attachment re-host.

### 3.3 Multi-tenant on Airtable is off-label and has documented failure modes

- Multi-tenant SaaS on Airtable is "not possible out of the box with native Airtable functionality, requiring custom API integration workarounds. The platform's design wasn't intended for this use case."
  Source: [Airtable Community — Multi-tenant architecture](https://community.airtable.com/t5/other-questions/multi-tenant-architecture/td-p/73985).
- "Single-tenant requires patching and updating each instance separately… most SaaS teams pick their database model before they understand their tenant isolation requirements, and that single decision, made in week two of a project, ends up costing six to twelve months of re-architecture once the product hits 500 paying customers."
  Source: [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture).
- One-base-per-tenant means schema migrations (and there will be many in months 1-3) get N-fanned out — every new field/table needs MCP-replay across every customer's base. The 5 req/sec ceiling is per-base, so a fan-out script across 10 bases also serializes through the 50 req/sec workspace token cap.
  Source: [Airtable API Rate Limits](https://airtable.com/developers/web/api/rate-limits).

### 3.4 Cost trajectory

- At Team ($20/seat/mo) with this CEO + ~3 agents + 1 admin + read-only support = $100/mo per customer at minimum. Move to Business at first hard limit = $225/mo per customer.
  Source: [Airtable Plans](https://support.airtable.com/docs/airtable-plans).
- At customer 10, Business plan worst-case: $2,250/mo recurring just to keep tenants on the backend. Compare Supabase: Pro plan $25/mo flat for the whole project, scales with usage not seats.
  Source: [Supabase pricing](https://supabase.com/pricing) (Pro $25/mo + usage).
- One business owner cited in Servalian: enterprise Airtable for their scale "would cost over $60,000 annually."
  Source: [Servalian](https://servalian.com/blog/airtable-record-limits).

### 3.5 Postgres day-1 cost is small, not "weeks"

Rebuts `CLAUDE.md` "Airtable formulas + Kanban + import save weeks":

- **Kanban:** Atomic CRM (MIT, React + shadcn/ui + Supabase) ships a drag-drop Kanban deal pipeline. Marmelab's shadcn-dnd-kit Kanban tutorial (Jan 2026) is a drop-in. Effort: 1-2 days to adapt.
  Source: [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm), [Marmelab Kanban tutorial](https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html), [react-dnd-kit-tailwind-shadcn-ui](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui).
- **Formulas (TCV, term-months):** Postgres `GENERATED ALWAYS AS (...) STORED`. TCV = `annual_usage * EXTRACT(year FROM age(end_date, start_date)) * agent_mils / 1000.0`. Hours, not days. Beats Airtable formulas — no cache staleness, indexable.
- **Import (xlsx → DB):** Same Bun script `TASKS.md:46-54` already specs — retarget to Postgres. `INSERT … ON CONFLICT` more idempotent than Airtable's no-transactions model. Effort identical.
- **Schema-as-MCP-clicks:** Replaced by `drizzle-kit push` or hand-written SQL. Schema in git, typed end-to-end.

Total cost of Postgres day 1: ~3-5 days. Reclaimed by skipping eventual migration + per-customer-base schema fan-out.

### 3.6 Cloudflare Workers + Postgres is a solved problem

Implicit "Workers doesn't love Postgres" argument no longer holds in 2026:

- Cloudflare Hyperdrive does global connection pooling + edge caching for Postgres from Workers. Supabase officially supports the path.
  Source: [Hyperdrive + Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/), [Connection pooling](https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/).
- Pattern: `postgres-js` direct over Hyperdrive (skip the Supabase JS client tax). Lower p99 than an Airtable round-trip.

### 3.7 Multi-tenancy on Supabase is well-trodden

- Two production patterns: shared schema + `tenant_id` column with RLS using `auth.jwt()`, or schema-per-tenant. The pattern-matching docs are extensive.
  Source: [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security), [MakerKit RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices), [Stacksync multi-tenancy guide](https://www.stacksync.com/blog/supabase-multi-tenancy-crm-integration).
- Performance pitfalls are real but well-documented (index policy columns, `(SELECT auth.uid())` to memoize, security-definer functions for joins). They turn "3-minute queries into 2ms."
  Source: [MakerKit RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices).
- Critically: this work is the *same* work we'd have to do post-Airtable-migration anyway, plus the migration itself. Doing it once now is strictly cheaper than doing it twice.

### 3.8 Comparable cases — no public proof that Airtable-as-multi-tenant-CRM-backend scales

Searches for "multi-tenant SaaS Airtable past 10 paying customers" surface:
- Community threads asking how to do it and being told to roll custom workarounds.
  Source: [Airtable community](https://community.airtable.com/base-design-9/multi-tenant-base-ideas-45420).
- Migration write-ups from teams who tried and bailed.
  Source: [Latenode write-up](https://community.latenode.com/t/abandoned-my-custom-migration-script-for-moving-from-airtable-to-supabase-no-regrets-about-this-choice/28785), [n8n Airtable→Postgres workflow built after the team "exceeded usage limits"](https://n8n.io/workflows/4772-automated-airtable-to-postgres-migration-with-n8n/).
- Zero public case studies of a production multi-tenant CRM SaaS running on Airtable past ~10 paying customers without migration. **Absence of evidence is itself evidence here** — Airtable is well-known, and a successful 10+ customer multi-tenant SaaS built on it would be a popular blog post.

## 4. Alternatives considered

### 4.1 Supabase Postgres day 1 (proposed)

- **Stack:** Supabase Postgres (project `coynbufhejaeuifpvmvw` already provisioned per `HANDOFF.md`), Postgres.js or Drizzle from Workers via Hyperdrive, RLS by `tenant_id` keyed off `auth.jwt() -> 'tenant_id'`, Supabase Storage for LOA PDFs + commission statements.
- **Right when:** schema known up front (it is — `TASKS.md:25-33` already lists 8 tables), team comfortable with SQL, multi-tenant target, eventual destination Postgres anyway, need real transactions for close-deal flow.
- **Trade:** ~3-5 days more setup than Airtable. No managed grid UI for admin overrides (mitigate with row-level edit in app or pgAdmin/Supabase Studio for ops).
- **Net:** correct call here.

### 4.2 Stay on Airtable past customer 10 (status quo)

- **Right when:** customer count caps at 5-10, deal volume per tenant stays under 20k records, no need for real transactions, no per-tenant compliance asks.
- **Why not here:** product is explicitly CRM-as-a-service with subdomain-per-tenant, and the first customer alone plausibly crosses the performance-degradation line within a year. Multi-tenant on Airtable isn't designed-for. Cost trajectory hostile.

### 4.3 Raw Postgres + RLS (no Supabase)

- **Right when:** want zero vendor dependency on Supabase Auth/Storage, ship own auth.
- **Why not here:** Supabase Auth is already provisioned (`HANDOFF.md:24`), shaves multi-week auth implementation. Storage handles LOA PDFs and commission statements out of the box. Postgres is still Postgres — swap-out cost later is low.

### 4.4 Notion DB

- **Right when:** doc-shaped, low-volume, internal tooling only.
- **Why not here:** Notion API is slower and rate-limited harder than Airtable (3 req/sec average), even fewer relational guarantees, no formula fields exposed via API the way Airtable's are. Strictly worse than Airtable for this domain, and Airtable is already a bad fit.

### 4.5 Baserow (self-hosted Airtable-shaped)

- **Right when:** want spreadsheet-like UI for ops, need it self-hosted on own infra, OK running a Django + Postgres + Redis stack.
- **Why not here:** Baserow's strength is the grid UI for non-technical end users, which we're explicitly *not* exposing — customers never see the backend (`README.md:97-98`). All the Baserow extras (real-time grid, app builder) are surface we throw away. Self-hosting it on CF Workers is impossible (Django ≠ Workers); we'd need a separate Fly/Render box. Worst of both worlds.
  Source: [Baserow vs NocoDB 2026](https://www.stackfyi.com/guides/baserow-vs-nocodb-2026).

### 4.6 NocoDB on top of Postgres

- **Right when:** want spreadsheet UI as a secondary surface over an existing Postgres production database.
- **Why not here:** then we're still building on Postgres — NocoDB is just an admin overlay. Pick Postgres direct + use Supabase Studio for ad-hoc ops. Also: NocoDB switched off AGPL to a "Sustainable Use License" with restrictions on managed-service offering, which constrains us if we ever expose any NocoDB surface to customers.
  Source: [NocoDB license change](https://www.stackfyi.com/guides/baserow-vs-nocodb-2026).

## 5. Proposed agent-file edits

### `README.md:85` → replace single line

```
Decision: **Supabase Postgres day 1.** Worker connects via Cloudflare Hyperdrive (pooled). RLS enforces tenant isolation by `tenant_id` claim in the Supabase JWT. Schema-as-code via Drizzle (or hand SQL) — committed, not click-built. The earlier "Airtable v1, migrate at customer 10-20" plan was rejected after vetting: linked records and formulas don't migrate cleanly, multi-tenant on Airtable is off-label with public failure modes, performance degrades around 20k records/base, and the eventual migration cost outweighs the 3-5 days of setup time Airtable would have saved.
```

### `README.md:87-93` → replace diagram block

```
greenenergiai.virecrm.com (TanStack Start SPA)
  ↓
Cloudflare Worker (auth, tenant routing, Outlook OAuth, caching)
  ↓  (via Hyperdrive — pooled, edge-cached)
Supabase Postgres (one project, RLS by tenant_id, Supabase Storage for PDFs)
```

### `README.md:95-99` → replace "Why this hits fast" block with full prose

```
Why Postgres day 1 (not Airtable-then-migrate):

- **Faster end-to-end than the "stage on Airtable" plan once you count rework.** Open-source Kanban (Atomic CRM, MIT, ships Supabase + shadcn + drag-drop pipeline) covers the UI claim Airtable was making. TCV and term-months are one-line `GENERATED ALWAYS AS` columns. The xlsx import is the same Bun script either way — just targets Postgres.
- **Multi-tenant by design.** Subdomain → tenant_id JWT claim → RLS filters every read/write. New customer = INSERT row in `tenants`, not "MCP-clone an Airtable base + replay schema."
- **No forced migration.** Airtable's 50k record/base ceiling and 5 req/sec API limit are real walls customer #1 plausibly hits within year 1. Postgres scales on its own clock.
- **Real transactions for close-deal.** Airtable has none — close-deal idempotency was a known footgun in the prior plan (`CLAUDE.md` §Conventions). Postgres makes that go away.
```

### `README.md:103-110` → replace Stack block

```
- **Frontend:** TanStack Start (React + Vite + file-based routing + SSR). Kept from prior Lovable scaffold.
- **Backend:** Supabase Postgres (project `coynbufhejaeuifpvmvw`). One project, multi-tenant by `tenant_id` column + RLS. Supabase Storage holds LOA PDFs + commission statements.
- **API layer:** Cloudflare Worker (`src/server.ts`). Routes requests, verifies Supabase JWT, queries Postgres via Hyperdrive-pooled `postgres-js` driver. Handles Outlook OAuth + Microsoft Graph calls.
- **Auth:** Supabase Auth. JWT carries `tenant_id` custom claim. Worker enforces; Postgres RLS double-checks.
- **Payments:** Stripe (account `51TYVK6`, currently test-mode key `pk_test_REPLACE_ME` — needs replacing from dashboard).
- **Deploy:** Cloudflare Workers via Wrangler. Routes in `wrangler.jsonc` cover `virecrm.com` (canonical) + `majix.ai/*` (308 → virecrm). Wildcard `*.virecrm.com/*` carries tenant subdomains.
- **Package manager:** Bun only. Foreign lockfiles git-ignored.
```

### `CLAUDE.md` §Architecture → replace whole block

```
## Architecture (do not relitigate without cause)

```
SPA (TanStack Start) → CF Worker → Hyperdrive → Supabase Postgres
```

- **Postgres = data backend.** One Supabase project (`coynbufhejaeuifpvmvw`). Multi-tenant by `tenant_id` col + RLS keyed off `auth.jwt() -> 'tenant_id'`. Supabase Storage for LOA PDFs + commission statements.
- **Worker = only DB client.** Frontend never queries Postgres direct. Worker verifies JWT, resolves tenant from Host header (cross-checks JWT claim), queries via `postgres-js` over Hyperdrive pool.
- **TanStack Start SPA.** React + Vite + file-based routing + SSR. Kept from prior Lovable scaffold.
- **Supabase Auth.** JWT carries `tenant_id`. Worker enforces; RLS double-checks. No DB row visible across tenants.
- **Schema-as-code.** Drizzle migrations in `src/server/db/migrations/`. Committed. No click-built schema.

Rejected and why (don't re-propose):
- Airtable-as-backend — vetted 2026-05-22, found unsuitable. See `docs/decisions/01-data-backend.md`. 50k record/base wall, formulas + linked records don't migrate cleanly, multi-tenant off-label, forced cost ramp at customer growth.
- Atomic CRM fork — generic sales CRM, 80% rewrite for energy domain, 15k LoC inheritance for ~3wk head-start = bad trade. (Still mine its Kanban code under MIT — fork vs. cherry-pick is different question.)
- Twenty CRM — AGPLv3 + NestJS doesn't run on CF Workers.
- NextCRM — Next.js, no Supabase, re-skin cost.
```
```

### `CLAUDE.md` §"What to NOT do" → replace one line

```
- Don't propose moving back to Airtable. Vetted + rejected 2026-05-22 (see `docs/decisions/01-data-backend.md`).
```

### `CLAUDE.md` §Stack invariants → replace one line

```
- **Postgres backend** via Supabase. Schema-as-code (Drizzle). Don't relitigate without strong reason.
```

### `CLAUDE.md` §Conventions — remove three Airtable-coupled lines, replace block

```
- **Schema-first.** Domain entities (Customer / ServiceAddress / ESI / Contract / Deal / Agent / LOA / CommissionStatement) are real Postgres tables. Linked via FKs. No custom-field bag on a generic Contact.
- **Worker = auth + tenant boundary.** Verify Supabase JWT. Cross-check `tenant_id` claim against Host header tenant. RLS is defense-in-depth, not primary gate.
- **Transactions for close-deal.** Use Postgres transactions for the won-deal → contract-create → ESI-attach flow. No more idempotency-tokens-because-no-transactions theater.
- **Indexes on RLS-policy columns.** `tenant_id` indexed on every table. `(SELECT auth.uid())` wrap in policies to memoize.
- **Storage = Supabase Storage.** LOA PDFs + commission statement PDFs. Signed URLs, tenant-scoped buckets.
```

### `AGENTS.md:18` → replace one line

```
`SPA (TanStack Start) → CF Worker → Hyperdrive → Supabase Postgres`. Worker = only DB client. Supabase Auth. RLS by `tenant_id`.
```

### `AGENTS.md:34` → replace one line (tool routing)

```
- Schema migrations + data → Drizzle CLI + `psql`/Supabase Studio. No Airtable MCP for domain data.
```

### `AGENTS.md:44` → replace one line (stack invariants)

```
- **Postgres backend** (Supabase). Don't migrate away without explicit decision.
```

### `TASKS.md:14` → replace one line

```
- [x] **Architecture decided.** Supabase Postgres + Cloudflare Worker (Hyperdrive) + TanStack Start SPA. Airtable rejected after vetting (`docs/decisions/01-data-backend.md`). Atomic-CRM-fork, Twenty, NextCRM also rejected.
```

### `TASKS.md:16` → replace Airtable PAT bullet

```
- [ ] **Hyperdrive config.** `wrangler hyperdrive create greenergiai-pg` against Supabase direct connection string. Bind in `wrangler.jsonc`. Store Supabase service role key as Worker secret (`wrangler secret put SUPABASE_SERVICE_ROLE`) only for admin-path code.
```

### `TASKS.md:17` → replace tenant routing bullet

```
- [ ] **Tenant routing in Worker.** Read `Host` header → resolve `tenant_id`. Cross-check against JWT `tenant_id` claim. Hardcode map `greenenergiai.virecrm.com → tenant-uuid-greenergiai` for now.
```

### `TASKS.md:20-35` → replace whole "Phase 1 — Domain schema (in Airtable)" block

```
## Phase 1 — Domain schema (Postgres)

Schema lives in `src/server/db/schema.ts` (Drizzle). Migrations committed. No click-built tables.

- [ ] **Tenants table.** `id uuid pk`, `subdomain text unique`, `display_name text`, `created_at`. Seed `greenergiai` row.
- [ ] **Schema:**
  - `customers` — `id`, `tenant_id` (FK + indexed for RLS), `name`, `primary_title`, `primary_phone`, `primary_email`, `notes`, timestamps.
  - `service_addresses` — `id`, `tenant_id`, `customer_id` FK, `street`, `city`, `state`, `zip`.
  - `esis` — `id`, `tenant_id`, `service_address_id` FK, `esi_number` text (CHECK starts with `1044` for Oncor by default, soft validation), `annual_usage_kwh int`, `current_contract_id` FK nullable.
  - `contracts` — `id`, `tenant_id`, `esi_id` FK, `deal_id` FK, `supplier_id` FK → `suppliers`, `start_date`, `end_date`, `term_months int GENERATED ALWAYS AS (...)` stored, `cost_per_kwh numeric(10,5)`, `agent_mils numeric(8,3)`, `status` enum (`pending`/`active`/`expired`/`lost`), `tcv numeric GENERATED ALWAYS AS (annual_usage_kwh * term_months / 12.0 * agent_mils / 1000.0) STORED`.
  - `deals` — `id`, `tenant_id`, `customer_id` FK, `name`, `stage` enum (`Lead`/`Qualified`/`In Pricing`/`Sent`/`Won`/`Lost`), `agent_id` FK, `contract_id` FK nullable (set on Won), timestamps.
  - `agents` — `id`, `tenant_id`, `name`, `email`, `house_split_pct numeric(5,2)`, `user_id` FK → `auth.users` (for the agent's own login).
  - `loas` — `id`, `tenant_id`, `customer_id` FK, `storage_path text` (Supabase Storage key), `signed_date`, `expiration_date`.
  - `commission_statements` — `id`, `tenant_id`, `supplier_id` FK, `period_month date`, `storage_path text`, `total_paid numeric`.
  - `suppliers` — `id`, `tenant_id` (nullable: global REP list + tenant overrides), `name`. **[SUPERSEDED by Doc 06 — collapsed to text field on `Contracts.supplier` + `CommissionStatements.supplier`; not built as standalone table. Current scaffold in `workers/db/schema/` follows Doc 06.]**
- [ ] **RLS policies.** Every table: `USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))`. Index `tenant_id` on every table.
- [ ] **Suppliers seed.** Curated TX REP list as `tenant_id NULL` global rows.
- [ ] **Sanity-check schema** with Darsh before importing data.
```

### `TASKS.md:38-44` → replace whole "Phase 1.5 — Worker data layer" block

```
## Phase 1.5 — Worker data layer

Worker = only DB client. Frontend talks to Worker, never Postgres direct.

- [ ] **DB module.** `src/server/db/client.ts` — `postgres-js` over Hyperdrive binding. Drizzle on top for typed queries.
- [ ] **Read cache.** CF cache API or KV for hot reads (customer detail, pipeline view). TTL 30-60s. Invalidate on writes.
- [ ] **Auth gate.** Supabase JWT verified in Worker (JWKS cached). Tenant claim cross-checked against Host header. Mismatch = 403.
- [ ] **Transaction helper.** `withTx(fn)` for close-deal flow.
```

### `TASKS.md:46-54` → update Phase 2 wording

```
## Phase 2 — One-shot xlsx migration `[stated]`

One-time launch task — not a recurring user-facing import UI. Run once, she sees her data live.

- [ ] **Parse `Copy of NGP MASTER LIST - Copy.xlsx`** in a Bun script. Dump headers + first 20 rows. Confirm column→table mapping with Darsh before any write.
- [ ] **Field mapping spec.** `docs/migration/field-map.md` — xlsx column → target `table.column`.
- [ ] **Migration script.** Idempotent (`INSERT … ON CONFLICT DO UPDATE`). Reads xlsx, normalizes (ESI string, dates ISO, dollar amounts, mils → numeric). Writes in a single Postgres transaction per customer for atomicity. Row-by-row error log.
- [ ] **Spot-check 5 customer records in UI** before declaring import done.
- [ ] **Backfill two years of historical clients** via same script.
```

### `HANDOFF.md:16-25` → replace "Decisions locked" block

```
## Decisions locked

1. **Customer #1:** greenergiai CEO, TX commercial electricity broker.
2. **Subdomain:** `greenenergiai.virecrm.com`.
3. **Project shape:** B — CRM-as-a-service product. Multi-tenant by subdomain.
4. **Architecture:** SPA (TanStack Start) → CF Worker → Hyperdrive → Supabase Postgres. See `docs/decisions/01-data-backend.md` for vetting trail.
5. **Backend:** Supabase Postgres day 1 (Airtable rejected after vetting).
6. **Frontend:** TanStack Start kept.
7. **Auth:** Supabase Auth. JWT carries `tenant_id`. RLS enforces.
8. **Bun only.**
```

### `HANDOFF.md:45-52` → replace "Immediate next steps"

```
## Immediate next steps for the next session

In order:

1. **Inspect xlsx headers.** Bun script — dump column names + first 5 rows. Confirms schema fit before any DB write.
2. **Drizzle init.** `bun add drizzle-orm postgres drizzle-kit`. Author schema per `TASKS.md` Phase 1. Run `drizzle-kit push` against Supabase.
3. **Hyperdrive config.** `wrangler hyperdrive create greenergiai-pg` with Supabase direct connection string. Bind in `wrangler.jsonc`.
4. **TanStack Start bootstrap.** `bunx create-tsrouter-app@latest .` — verify current scaffold cmd via context7 first.
5. **Wire Worker → Postgres.** Stub one read function. Verify via `wrangler dev`.
6. **RLS + tenant_id JWT claim.** Configure Supabase Auth hook to inject `tenant_id` into JWT on sign-in. Author RLS policies.
```

### `HANDOFF.md:54-58` → replace "Things blocking real work"

```
## Things blocking real work

- **Stripe key still `pk_test_REPLACE_ME`** (`.env.development`). Pull from Stripe dashboard, account `51TYVK6`, test mode.
- **Supabase Auth hook for `tenant_id` claim.** Configure via Supabase dashboard or `auth.hooks` migration. Decide UUID-of-tenants-row vs. subdomain-string.
- **Microsoft Graph app registration** (for Outlook). Defer until Phase 5.
```

## 6. Open questions

1. **Schema-per-tenant vs. shared schema?** Defaulting to shared-schema + `tenant_id` column + RLS — simpler, well-trodden, scales to thousands of tenants. Schema-per-tenant only if a customer demands physical isolation (compliance ask). Need user sign-off.
2. **Atomic CRM cherry-pick vs. clean build?** Atomic CRM (MIT) ships a working Supabase + shadcn + Kanban deal pipeline. Forking is rejected (`CLAUDE.md`), but cherry-picking the Kanban component + drag-drop wiring is fair game and saves 1-2 days. Confirm allowed.
3. **Drizzle vs. raw SQL migrations?** Drizzle = typed end-to-end, popular with Workers stack. Raw SQL = lower-friction for ad-hoc changes. Defaulting to Drizzle. Ask user.
4. **Atomic CRM was rejected on grounds that include "Supabase from day one was wrong start."** Does flipping that ground change the Atomic CRM rejection? Recommendation: still don't fork the whole app (energy-domain rewrite cost is real), but harvest the Kanban + deal-detail React components under MIT.
5. **Does the customer (greenergiai CEO) get to see/edit the DB through any non-app surface?** If yes — even just for the one-shot xlsx ops — we need Supabase Studio access or a tiny ops UI. If no, ignore.
