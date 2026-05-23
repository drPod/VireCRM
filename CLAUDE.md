# genesisxsx — agent conventions

> **⚠ Agent-authored.** Drafted by AI agents from conversation context + source-file inspection + web research. Expect AI-pattern reasoning and unverified assumptions. Treat load-bearing claims as starting points to verify, not facts. Edits welcome.

CRM-as-a-service product on `virecrm.com`. Customer #1 = greenergiai (TX commercial electricity broker) at `greenenergiai.virecrm.com`.

**Read these first, in order:**
1. `README.md` — what we're building + why
2. `docs/decisions/` — 10 load-bearing picks + rationale (read the one you're touching)

## Architecture (do not relitigate without cause)

```
SPA (React Router v7 framework mode) → CF Worker → Supabase Postgres (via Hyperdrive)
                                            ↓
                                Supabase Auth + Storage + Vault
                                MS Graph (per-agent OAuth)
                                Stripe (billing, customer #2+)
```

- **Supabase Postgres = data backend, day 1.** Project `coynbufhejaeuifpvmvw`. Drizzle ORM + migrations in `src/server/db/`. Shared schema, `tenant_id` col on every domain table, RLS keyed on `auth.jwt() -> 'tenant_id'`. `postgres-js` client over Cloudflare Hyperdrive (pooled).
- **Worker = only Postgres client.** Frontend talks to Worker, never to Postgres / Supabase directly. Worker handles JWT verify, tenant cross-check, batching, caching, Outlook OAuth, Stripe webhooks.
- **React Router v7 framework mode SPA.** `@cloudflare/vite-plugin` v1.0 GA. Scaffold via `bun create cloudflare@latest -- . --framework=react-router`.
- **Supabase Auth.** JWT verified in Worker via `@supabase/server` (asymmetric ES256/RS256). JWKS edge-cached 10 min. NEVER HS256.
- **Outlook integration.** Per-agent MS Graph OAuth (identity v2 + PKCE, confidential client).
- **Stripe billing deferred to customer #2.** greenergiai = unbilled founding pilot.

Rejected and why (don't re-propose):

- **Airtable as primary backend** — 100K rows/table hard cap on every tier (incl. Enterprise), 5 req/sec per base, no transactions, no real RLS. Doc 01.
- **TanStack Start** — still 1.0-RC, open prod-build bug on CF Workers (`router#6185`, `#5208`, `#6045`). Re-eval at stable 1.0. Doc 02.
- **Atomic CRM fork** — generic sales CRM, 80% rewrite for energy domain. Kanban code cherry-pick (MIT) OK. Doc 01 + Doc 10.
- **Twenty CRM** — AGPLv3 + NestJS doesn't run on CF Workers.
- **NextCRM** — Next.js, re-skin cost.
- **Schema-per-tenant Postgres** — shared schema + `tenant_id` + RLS instead. Doc 01.
- **MoR providers (Paddle / Lemon Squeezy / Stripe Managed Payments)** — 5-6.4% vs Stripe+Stripe Tax ~3.4%. Reevaluate at international or 5+ state nexus. Doc 09.
- **Outlook vendors (Nylas, Unipile, Pipedream)** — ~$16k build vs ~$270/yr Nylas → break-even >60yr. CEO #1 pain (on-prem Exchange + Outlook Desktop) unfixable by any vendor. Doc 05.
- **HS256 JWT verification.** Always asymmetric. Doc 04.
- **"Pure Supabase from day one — wrong start"** — overturned by Doc 01. Postgres day 1 IS the call now.

## Stack invariants

- **Bun preferred** (not "only"). CF build image has all 4 PMs. Commit `bun.lock` text format. Don't silently strip foreign lockfiles — flag + decide.
- **React Router v7 framework mode + `@cloudflare/vite-plugin` GA.** Internal `/api/*` via Hono inside Worker OK.
- **CF Workers deploy.** `nodejs_compat` ON (zero runtime cost; `node:buffer`/`node:crypto` importable — check `wrangler.jsonc` before adding node imports).
- **Postgres day 1.** No Airtable. Drizzle migrations checked in. Schema = code, never click-built.
- **Supabase Auth + Storage + Vault.** Auth = users + sessions + JWT. Storage = LOA + commission PDFs. Vault = per-agent OAuth refresh tokens (libsodium AEAD).
- **Kanban = custom in SPA via `@dnd-kit/core` v6.3.1** (MIT). Not iframe. Not Atomic CRM.

## Domain glossary (memorize)

- **ESI ID** — Electric Service Identifier. Canonical name. xlsx label "Meter Number" = colloquial. 17–22 digits. Oncor prefix `1044372…` (East TX = `1017699…`). Tied to service address, not device. Universal key in TX energy. One ESI per service address. First-class entity, never a custom field.
- **Physical Meter Serial** — distinct from ESI ID. Device serial printed on meter. Changes on meter swap. xlsx `Meter Id`. Preserve for supplier-invoice cross-reference.
- **EAC** — Estimated Annual Consumption (kWh). Set at contract signing.
- **AQ** / **Billing AQ** — Annual Quantity (kWh). Billing AQ = actual billed annual volume. **Commission paid against Billing AQ, not EAC.** Variance = #1 source of reconciliation disputes.
- **Mils** — thousandths of a dollar per kWh. Agent commission unit. `1 mil = $0.001/kWh`. xlsx label = "Unit Uplift".
- **TCV** — Total Contract Value. `Gross TCV = Annual Usage × Term Years × Agent Mils ÷ 1000`. `Net TCV = Gross − Lost`. Postgres `GENERATED ALWAYS AS (...) STORED` columns.
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

### Schema + data

- **9 domain tables.** Customer / ServiceAddress / ESI / Contract / Deal / Agent / LOA / CommissionStatement / AggregatorPayouts. Full spec: `docs/decisions/06-domain-schema.md`.
- **Round-trip 84 xlsx cols (4,792 rows).** 1 dropped (`Company` constant A), 1 dropped (duplicate `Customer Name` AJ), 1 dropped (empty `CF`). 6 COVID/historical metrics deferred. 75 round-trip. No silent column drops. Canonical counts from `scripts/inspect-xlsx.ts`; re-run when source xlsx replaced.
- **ESI ID canonical, not "Meter Number".** Import normalizes xlsx `Meter Number` → `ESIs.ESI ID`. xlsx `Meter Id` → `ESIs.Physical Meter Serial` (separate field).
- **Dual-agent deals.** `Deals.Primary Agent` + `Deals.Secondary Agent`. Never fold to one.
- **Contract lifecycle = 4 dims.** Pipeline Status (`pending`/`active`/`expired`/`lost`) + Is Live (boolean) + Lost path (Lost Date / Reason / Before Start / After Live) + Drop path (Drop Date / Reason). Don't collapse.
- **Real Postgres transactions for close-deal.** No idempotency theater. Use natural keys (`External Sale Id`, `External Customer Id`) for upserts during xlsx migration via `INSERT … ON CONFLICT`.
- **Index `tenant_id` on every domain table.** Composite indexes lead with `tenant_id`.

### Auth + tenancy

- **Tenant claim lives in `app_metadata.tenant_id` ONLY** (server-write-only). NEVER trust `user_metadata` for authz.
- **Host header = expected tenant; JWT claim = actual. Mismatch = 403.**
- **Customer-portal JWTs** (`customers.virecrm.com`) carry `role: customer` + `customer_id`. NOT `tenant_id`.
- **RLS on every domain table.** Wrap `(SELECT auth.uid())` in policies to memoize.
- **Two audiences, two subdomains.** `<tenant>.virecrm.com` = broker admin. `customers.virecrm.com` = end-customer portal (scope TBD).
- **Supabase enforces global email uniqueness.** One email = one user globally; flag if user crosses tenants.

### UI

- **Display values verbatim from the database.** No display-coercion (e.g. don't render stored `Non-HH` as `Electricity`). Round-trip principle extends to render layer.
- **Every domain label with non-obvious meaning gets a hover tooltip.** Trigger via `<abbr title>` or shadcn `Tooltip` — define the term plus where it came from. Required for at least: `ESI ID`, `Physical Meter Serial`, `EAC`, `AQ`, `Billing AQ`, `Mils`, `TCV`, `Gross TCV`, `Net TCV`, `Lost TCV`, `REP`, `LOA`, `Drop`, `Aggregator`, `Pri/Sec Agent`, `Is Live`, `In Pricing`, `Sale Status`, `Pipeline Stage`, `Non-HH`, `Nomination`, `SIC Code`, `Govt Area`, `Acq/Ren`, `Resold Status`. Canonical definitions live in this file's Domain glossary — UI strings stay in sync with it.
- **UK-origin labels rendered as-is + tooltip explains.** `Non-HH` (UK Non-Half-Hourly small-commercial electricity), `EAC`, `AQ`, `Nomination`, `Govt Area`, `SIC Code` — store and display as the xlsx encoded them. Doc 06 §3.

### Cache + rate

- **Per-isolate LRU cache TTL 10s** (~256 entries cap) + KV fallback for cold isolates (TTL 10s). NOT 30-60s.
- **Read-through-after-write.** Request that just wrote bypasses cache.
- **Token bucket rate-limit** for any external API w/ hard ceilings (e.g. MS Graph): 5 tokens/sec burst, queue→503 at >20.

### Outlook (MS Graph)

- **Per-agent OAuth.** MS identity v2 authorization-code-with-PKCE, confidential client.
- **`MS_GRAPH_CLIENT_SECRET` → Wrangler.** Per-agent refresh tokens → **Supabase Vault**, NEVER Wrangler.
- **Refresh tokens = 90-day sliding** (NOT 60-day). Mail webhooks expire **~70 hours / 2.94 days** (NOT 7 days). Cron renew every ~48h.
- **Refresh-on-use, not cron.** Single-flight lock per agent on refresh. Reconnect-UX toast at 75 days.
- **Required scopes:** `Mail.ReadWrite Mail.Send Calendars.ReadWrite User.Read MailboxSettings.Read offline_access`. Drop `offline_access` = no refresh token = hard fail.
- **Attachments:** ≤3MB inline; 3-150MB via `createUploadSession` + 4MB chunks.
- **Throttle:** 4 concurrent + ≤10 req/sec per app+mailbox.
- **Unsupported, sales must not promise:** on-prem Exchange, Outlook Desktop local calendar (Graph limit, not ours).
- **Webhook handshake:** echo `validationToken` <10s.

### Stripe

- **Deferred to Phase 6.5** (gated on customer #2). greenergiai = unbilled founding pilot.
- **stripe-node v22+.** `httpClient: Stripe.createFetchHttpClient()` + `constructEventAsync` + `Stripe.createSubtleCryptoProvider()` for webhook verification (WebCrypto async on Workers). NO extra `nodejs_compat` needed for stripe-node since v11.10.0.
- **Stripe Tax** (0.5%/tx in registered states). Register home state only until $500K nexus elsewhere.
- **`pk_live_*` safe to commit** (Stripe guidance — publishable). `sk_live_*` → `wrangler secret put` ONLY.

## What to NOT do

- Don't reintroduce Airtable as primary backend. Decision overturned. Doc 01.
- Don't propose TanStack Start swap until 1.0 GA + CF Workers prod-build fix.
- Don't fork Atomic CRM. Don't add Twenty, NextCRM to deps.
- Don't use HS256 JWTs. Always asymmetric.
- Don't trust `user_metadata` for authz. Server-write `app_metadata.tenant_id` only.
- Don't store `sk_live_*`, `SUPABASE_SERVICE_ROLE`, `MS_GRAPH_CLIENT_SECRET`, or Postgres URL in `.env`. Use `wrangler secret put` (or Hyperdrive binding).
- Don't drop `offline_access` Outlook scope.
- Don't use `constructEvent` sync for Stripe webhooks on Workers. Use `constructEventAsync`.
- Don't paste customer xlsx data into git. `.gitignore` blocks `*.xlsx`.
- Don't commit `og_database/`, `*.sql.dump`, `*.pgdump` (legacy Lovable PII dumps).
- Don't expose raw `auth.uid()` or `customer_id` in URLs without RLS gating.
- Don't ship without verifying Supabase JWT signature in Worker.
- Don't click-build Postgres schema. Drizzle migrations checked in.

## Verify before claiming done — concrete gates

Scripts in `scripts/` enforce the rule. Run before declaring done:

- **`bash scripts/agent-check.sh`** — typecheck gate. Run after any multi-file TS write. Catches hallucinated imports, broken types.
- **`bash scripts/check-schema-drift.sh`** — drizzle schema-vs-migration check. Run after editing `workers/db/schema/*.ts`. Catches schema TS edit without `bun run db:generate`.
- **`bash scripts/check-worker-config.sh`** — wrangler binding check. Run after editing `wrangler.jsonc` OR adding `c.env.X` ref in Worker code. Catches binding referenced but not declared.
- **`bash scripts/check-build.sh`** — full build smoke test (~30s). Run after editing Vite / Tailwind / React Router config or routes. Catches directive errors, vite plugin failures, route config drift.
- **`bash scripts/sync-npm-types.sh`** — refresh `docs/_npm-types/`. Run after `bun install` adds new pkg. Otherwise runs via `postinstall`.

Rationale + 3 failure modes: `docs/agent-prevention.md`.

## Tool routing

- **Postgres schema/data** → Drizzle CLI + `psql` + Supabase Studio. Project `coynbufhejaeuifpvmvw`.
- **Lib docs** — read local vendor mirror first: `docs/react-router-v7/`, `docs/cloudflare-vite-plugin/`, `docs/wrangler/`, `docs/supabase/`, `docs/stripe-node/`, `docs/microsoft-graph/`, `docs/hono/`, `docs/drizzle/`, `docs/dnd-kit/`. Each ships `README.md` (fat router) + `llms-full.txt` / `reference.md` / per-page scrapes + `_snapshot_date.txt`. Refresh via `scripts/sync-<lib>-docs.sh`. Fall through to `context7` MCP only when mirror lacks the topic.
- **npm package types** (named imports, type symbols, function signatures) → read `docs/_npm-types/<pkg>/` first (`/` in pkg name → `__`, e.g. `@supabase/server` → `@supabase__server`). Mirrors `node_modules/<pkg>/**/*.d.{ts,cts,mts}` so `grep -r 'JWTClaims' docs/_npm-types/@supabase__server/` finds actual export. Distinct from `docs/<lib>/` (product docs — usage + concepts, no `.d.ts`). Refresh via `bash scripts/sync-npm-types.sh` (runs on `postinstall`).
- **Audit subagents** — subagent auditing code (imports, schema, config) MUST run `bash scripts/agent-check.sh` AND grep `docs/_npm-types/<pkg>/` for every named import before reporting "imports clean." Vibes audits insufficient — `tsc -b` catches in 2s what 3 parallel grep-based audits miss.
- **Cross-repo search** → delphi.
- **Browser verification** → see `~/.claude/rules/browser.md`.
- **Live state** (Node LTS, Supabase API changes, Stripe API versions) → curl endoflife / WebSearch per `~/.claude/rules/lookups.md`.
- `.mcp.json` committed (HTTP transport config); document any new MCPs there.

## Secrets locations

<!-- Maintainer notes — stripped from agent context, visible only via Read tool:
- Supabase project ID: coynbufhejaeuifpvmvw
- Stripe account: 51TYVK6 (test mode key VITE_PAYMENTS_CLIENT_TOKEN currently pk_test_REPLACE_ME; replacement deferred to customer #2 per Doc 09)
- Airtable workspace: wspBUTSYGFioquhDD (historical; no longer primary domain backend post-Doc 01. MCP retained for any one-off legacy data ops.)
- CF zones: virecrm.com (canonical), majix.ai (308 redirects)
- Original CRM the CEO walked away from: Go High Level
- Source data: Copy of NGP MASTER LIST - Copy.xlsx (gitignored, not committed)
-->

- **Wrangler secrets:** `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `MS_GRAPH_CLIENT_SECRET`. Postgres connection via Hyperdrive binding in `wrangler.jsonc`, NOT secret env var.
- **Supabase Vault:** per-agent OAuth refresh tokens (libsodium AEAD; Key ID in DB, raw key outside SQL).
- **Public vars:** `wrangler.jsonc` `vars` block + `.env.development` for Vite.
- `.env` files git-ignored; `.env.example` tracks placeholder shape.
- `pk_live_*` / `pk_test_*` (Stripe publishable) safe in `.env.production` / `.env.development`.
