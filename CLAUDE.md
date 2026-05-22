# genesisxsx — agent conventions

CRM-as-a-service product on `virecrm.com`. Customer #1 = greenergiai (TX commercial electricity broker) at `greenenergiai.virecrm.com`.

**Read these first, in order:**
1. `README.md` — what we're building + why + architecture decision
2. `TASKS.md` — phased build plan, what's done, what's next
3. `HANDOFF.md` — most recent session state

## Architecture (do not relitigate without cause)

```
SPA (TanStack Start) → CF Worker → Airtable API
```

- **Airtable = data backend.** One base per tenant. Workspace `wspBUTSYGFioquhDD`. Single service PAT held by Worker. Customers never touch airtable.com.
- **Worker = only Airtable client.** Frontend talks to Worker, never to Airtable directly. Worker handles auth, tenant routing by Host header, RLS, caching (5 req/sec ceiling), batching (10 records/req), Outlook OAuth.
- **TanStack Start SPA.** React + Vite + file-based routing + SSR. Inherited from prior Lovable scaffold, kept.
- **Supabase Auth only.** No domain data in Postgres yet. Just users + sessions. Domain data = Airtable until migration.
- **Migration plan.** Airtable → Postgres at customer 10-20 or first scaling pain. Worker abstracts Airtable so migration = swap one module.

Rejected and why (don't re-propose):
- Atomic CRM fork — generic sales CRM, 80% rewrite for energy domain anyway, 15k LoC inheritance for ~3wk head-start = bad trade.
- Twenty CRM — AGPLv3 + NestJS doesn't run on CF Workers.
- NextCRM — Next.js, no Supabase, re-skin cost.
- Pure Supabase from day one — right destination, wrong start. Airtable formulas + Kanban + import save weeks.

## Stack invariants

- **Bun only.** `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` git-ignored. Never recreate.
- **TanStack Start kept.** Don't propose Next.js / Remix / plain Vite swap without strong reason.
- **CF Workers deploy.** Anything that needs long-running Node process is wrong tool here.
- **No Atomic CRM.** Decided against. Don't reopen.

## Domain glossary (memorize)

- **ESI ID** — Electric Service Identifier. Canonical name. xlsx label "Meter Number" = colloquial. 17–22 digits. Oncor prefix `1044372…` (East TX = `1017699…`). Tied to service address, not device. Universal key in TX energy. One ESI per service address. First-class entity, never a custom field.
- **Physical Meter Serial** — distinct from ESI ID. Device serial printed on meter. Changes on meter swap. xlsx `Meter Id`. Preserve for supplier-invoice cross-reference.
- **EAC** — Estimated Annual Consumption (kWh). Set at contract signing.
- **AQ** / **Billing AQ** — Annual Quantity (kWh). Billing AQ = actual billed annual volume. **Commission paid against Billing AQ, not EAC.** Variance = #1 source of reconciliation disputes.
- **Mils** — thousandths of a dollar per kWh. Agent commission unit. `1 mil = $0.001/kWh`. xlsx label = "Unit Uplift".
- **TCV** — Total Contract Value. `Gross TCV = Annual Usage × Term Years × Agent Mils ÷ 1000`. `Net TCV = Gross − Lost`. Airtable formula fields.
- **REP** — Retail Electric Provider. Supplier on a contract.
- **LOA** — Letter of Authorization. Customer-signed doc letting broker pull usage + shop on their behalf. Required before any "In Pricing" stage.
- **Drop** — supplier kicks customer off contract mid-term. TX industry term. Distinct from "lost" (customer leaves). Drop = supplier action.
- **Aggregator** — upstream broker. When she's a sub-broker, takes % cut. xlsx cols `Agg Name` + `Agg Comm %`. Tracked in `AggregatorPayouts` table.
- **Pri/Sec Agent** — dual-agent attribution. Every deal can carry 2 agents. `Deals.Primary Agent` + `Deals.Secondary Agent`. Never collapse.
- **Sale Status vs Pipeline Stage** — orthogonal. Sale Status = `Approved`/`Pending`/`Lost`. Stage = pipeline location.
- **Is Live** — contract reached start date + billing began. Distinct from Pipeline Status = `active` (signed but maybe future-dated).
- **In Pricing** — pipeline stage where deal is being quoted across REPs. Pre-won.
- **Current Clients** — view of customers with at least one `active` contract. Deal graduates here on close-won.

## Conventions

- **Schema-first.** 9 domain tables (Customer / ServiceAddress / ESI / Contract / Deal / Agent / LOA / CommissionStatement / AggregatorPayouts). Real Airtable tables, not custom fields on a generic Contact. Full spec: `docs/decisions/06-domain-schema.md`.
- **Round-trip 83 xlsx cols.** Migration drops 1 constant (`Company`) + 1 duplicate (`Customer Name` at col AJ). 6 COVID/historical metrics deferred. 75 round-trip. No silent column drops.
- **ESI ID canonical, not "Meter Number".** Import normalizes xlsx `Meter Number` → `ESIs.ESI ID`. xlsx `Meter Id` → `ESIs.Physical Meter Serial` (separate field).
- **Dual-agent deals.** `Deals.Primary Agent` + `Deals.Secondary Agent`. Never fold to one.
- **Contract lifecycle = 4 dims.** Pipeline Status (`pending`/`active`/`expired`/`lost`) + Is Live (boolean) + Lost path (Lost Date / Reason / Before Start / After Live) + Drop path (Drop Date / Reason). Don't collapse.
- **Worker is auth + RLS boundary.** Never expose Airtable PAT to frontend. Never trust JWT tenant claim without verification.
- **Idempotent writes.** Airtable has no transactions. Close-deal flow + migration must tolerate retry without duplicating state. Use `External Sale Id` / `External Customer Id` as natural keys.
- **Batch reads/writes.** 10 records/req. Cache hot reads in Worker. 5 req/sec per base is hard ceiling.
- **Webhooks expire 7 days.** Cron-refresh, don't assume they live forever.

## What to NOT do

- Don't propose migrating to Postgres yet. Decision is "later, when scaling pain hits."
- Don't fork a generic OSS CRM. Decided against.
- Don't add Atomic CRM, Twenty, NextCRM to deps.
- Don't store Airtable PAT in `.env` checked-in files. Use `wrangler secret put`.
- Don't expose Airtable record IDs to the frontend if they leak tenant info — use opaque IDs server-side.
- Don't paste customer xlsx data into git. `.gitignore` already blocks `*.xlsx`.

## Tool routing

- **Airtable schema/data** → `mcp__airtable__*` tools. Workspace `wspBUTSYGFioquhDD`.
- **Lib docs** (TanStack Start, Wrangler, Supabase JS, Stripe Node) → `context7` MCP.
- **Cross-repo search** → delphi.
- **Browser verification** → see `~/.claude/rules/browser.md`.
- **Live state** (Node LTS, Airtable API changes, Stripe API versions) → curl endoflife / WebSearch per `~/.claude/rules/lookups.md`.

## Secrets locations

<!-- Maintainer notes — stripped from agent context, visible only via Read tool:
- Supabase project ID: coynbufhejaeuifpvmvw
- Stripe account: 51TYVK6 (test mode key needs replacing — VITE_PAYMENTS_CLIENT_TOKEN currently pk_test_REPLACE_ME)
- Airtable workspace: wspBUTSYGFioquhDD
- CF zones: virecrm.com (canonical), majix.ai (308 redirects)
- Original CRM the CEO walked away from: Go High Level
- Source data: Copy of NGP MASTER LIST - Copy.xlsx (gitignored, not committed)
-->

- Wrangler secrets: `AIRTABLE_PAT`, `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `MS_GRAPH_CLIENT_SECRET`.
- Public vars: `wrangler.jsonc` `vars` block + `.env.development` for Vite.
- `.env` files are git-ignored; `.env.example` will track placeholder shape.
