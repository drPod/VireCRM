# AGENTS.md

> **⚠ Agent-authored.** Drafted by AI agents. Expect AI-pattern reasoning + unverified assumptions. Verify load-bearing claims before acting on them.

Routing file for any agent (Claude Code, Cursor, Aider, Copilot, etc.) entering this repo.

## What this repo is

CRM-as-a-service product on `virecrm.com`. Customer #1 = greenergiai (TX commercial electricity broker) at `greenenergiai.virecrm.com`. Multi-tenant by subdomain.

## Read order

1. `README.md` — product context + why-not-GHL + domain
2. `CLAUDE.md` — agent conventions, stack invariants, what NOT to do
3. `docs/decisions/` — 10 load-bearing picks (read the one you're touching)

## Architecture in one line

`SPA (React Router v7) → CF Worker → Supabase Postgres (via Hyperdrive)`. Worker = only Postgres client. Supabase Auth for users + tenants via RLS on `tenant_id`.

## Domain quick-ref

| Term | Meaning |
|---|---|
| ESI ID | Electric Service Identifier. Canonical name (xlsx label "Meter Number" colloquial). 17–22 digit. Oncor prefix `1044372…`. Universal key. Tied to service address, not device. |
| Physical Meter Serial | Device serial printed on meter. Distinct from ESI ID. xlsx `Meter Id`. |
| EAC | Estimated Annual Consumption (kWh). Signing-time estimate. |
| AQ / Billing AQ | Annual Quantity (kWh). Actual billed. Drives commission. |
| Mils | Thousandths of a dollar per kWh. Agent commission unit. xlsx "Unit Uplift". |
| TCV | Total Contract Value. `Gross = Annual Usage × Term yrs × Mils ÷ 1000`. `Net = Gross − Lost`. Postgres `GENERATED` column. |
| REP | Retail Electric Provider. Supplier on contract. |
| LOA | Letter of Authorization. Required before quoting (In Pricing stage). |
| Drop | Supplier kicks customer off mid-contract. Distinct from "lost." |
| Aggregator | Upstream broker; takes % when we're sub-broker. xlsx `Agg Name` + `Agg Comm %`. |
| Pri/Sec Agent | Two agents per deal. `Primary Agent` + `Secondary Agent` on Deals. |
| Sale Status vs Stage | Orthogonal. Sale Status = `Approved`/`Pending`/`Lost`. Stage = pipeline location. |
| Is Live | Contract reached start date + billing began. Distinct from Pipeline Status = `active`. |
| In Pricing | Pre-won pipeline stage. Deal being quoted across REPs. |
| Current Clients | Customers with ≥1 active contract. Auto-populated on close-won. |

## Tool routing

- Schema + data ops on Postgres → Drizzle CLI + `psql` + Supabase Studio. Project `coynbufhejaeuifpvmvw`. Bun scripts in `package.json`:
  - `bun run db:generate` — diff schema files → new migration in `drizzle/`
  - `bun run db:migrate` — apply pending migrations to `DATABASE_URL`
  - `bun run db:push` — push schema directly (dev only)
  - `bun run db:studio` — open Drizzle Studio
- Library docs — read local mirror first under `docs/<lib>/` (9 libs mirrored 2026-05-22: react-router-v7, cloudflare-vite-plugin, wrangler, supabase, stripe-node, microsoft-graph, hono, drizzle, dnd-kit). Each has a `README.md` fat router. Refresh via `scripts/sync-<lib>-docs.sh`. Fall through to `context7` MCP only if mirror lacks coverage.
- Live state (versions, vendor changes, CVE) → curl `endoflife.date` or WebSearch per `~/.claude/rules/lookups.md`.
- Browser verification → `~/.claude/rules/browser.md`.

## Stack invariants

- **Bun preferred.** CF build image has all 4 PMs. Don't silently strip foreign lockfiles.
- **React Router v7 framework mode** + `@cloudflare/vite-plugin` GA.
- **CF Workers deploy.** `nodejs_compat` on.
- **Supabase Postgres backend** (day 1). No Airtable. Drizzle migrations checked in.
- **Supabase Auth.** Asymmetric JWT, verified in Worker via `@supabase/server`. NEVER HS256.
- **Tenant claim = `app_metadata.tenant_id` only** (server-write). RLS on every domain table.
- **No generic OSS CRM fork.** Atomic / Twenty / NextCRM all evaluated, all rejected (Doc 01 + 10). `@dnd-kit/core` for Kanban.

## Verify before claiming done (enforced)

Static-contract gates are wired in three layers, not advised. You will be blocked, not warned:

1. **Claude Code Stop hook** (`.claude/settings.json`) — `tsc` runs at every stop attempt. FAIL → blocked. Claude Code only.
2. **`.githooks/pre-commit`** — runs `agent-check.sh` (and `check-schema-drift.sh` / `check-worker-config.sh` when their paths are staged) on every `git commit`. Blocks any committer (any agent harness, any human). Bypass: `git commit --no-verify` (shows in shell history). Wired via `prepare` script → `git config core.hooksPath .githooks`; runs on `bun install`. Run once manually if you cloned without installing: `git config core.hooksPath .githooks`.
3. **`.github/workflows/checks.yml`** — all 4 gates on every PR.

Scripts to run manually for tight feedback:

- `bash scripts/agent-check.sh` — typecheck (`wrangler types` + `react-router typegen` + `tsc -b`).
- `bash scripts/check-schema-drift.sh` — Drizzle schema vs committed migration.
- `bash scripts/check-worker-config.sh` — `c.env.X` references vs `wrangler.jsonc`.
- `bash scripts/check-build.sh` — Vite/Tailwind/RR full build smoke (~30s; CI only).

Full hallucination-class table + Phase 1.5 incident: `docs/agent-prevention.md`.

## Don't touch

- Customer xlsx files (`Copy of NGP MASTER LIST - Copy.xlsx`). Gitignored, contains PII.
- `og_database/`, `*.sql.dump`, `*.pgdump` — legacy Lovable Supabase dumps with PII. Never commit.
- `.env`, `.env.local`, `.env.*.local`. Use `wrangler secret put` for production secrets.

## Where to write things

| Type | Location |
|---|---|
| SPA code | `app/` (React Router v7 framework mode — routes, root, entry) |
| Worker entrypoint | `workers/app.ts` (referenced in `wrangler.jsonc`) |
| Worker route handlers / APIs | `workers/api/` |
| Postgres schema + migrations | `workers/db/` (Drizzle; `schema/` + `index.ts`) |
| Migration scripts (one-shot xlsx → Postgres) | `scripts/` |
| Vendor doc mirrors | `docs/<lib>/` |
| Field mapping spec | `docs/decisions/06-domain-schema.md` §1 (canonical 84-col → table.field) |
| Architectural decisions | `docs/decisions/<NN>-<topic>.md` |
