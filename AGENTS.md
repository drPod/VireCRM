# AGENTS.md

Routing file for any agent (Claude Code, Cursor, Aider, Copilot, etc.) entering this repo.

## What this repo is

CRM-as-a-service product on `virecrm.com`. Customer #1 = greenergiai (TX commercial electricity broker) at `greenenergiai.virecrm.com`. Multi-tenant by subdomain.

## Read order

1. `README.md` — product context + architecture decision + rationale
2. `CLAUDE.md` — agent conventions, stack invariants, what NOT to do
3. `TASKS.md` — phased backlog, what's done, what's next
4. `HANDOFF.md` — most recent session state, immediate next steps

## Architecture in one line

`SPA (TanStack Start) → CF Worker → Airtable API`. Worker = only Airtable client. Supabase Auth for users. Migrate to Postgres at scale.

## Domain quick-ref

| Term | Meaning |
|---|---|
| ESI ID | Electric Service Identifier. Canonical name (xlsx label "Meter Number" colloquial). 17–22 digit. Oncor prefix `1044372…`. Universal key. Tied to service address, not device. |
| Physical Meter Serial | Device serial printed on meter. Distinct from ESI ID. xlsx `Meter Id`. |
| EAC | Estimated Annual Consumption (kWh). Signing-time estimate. |
| AQ / Billing AQ | Annual Quantity (kWh). Actual billed. Drives commission. |
| Mils | Thousandths of a dollar per kWh. Agent commission unit. xlsx "Unit Uplift". |
| TCV | Total Contract Value. `Gross = Annual Usage × Term yrs × Mils ÷ 1000`. `Net = Gross − Lost`. |
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

- Schema + data ops on Airtable → `mcp__airtable__*` tools, workspace `wspBUTSYGFioquhDD`.
- Library docs (TanStack, Wrangler, Supabase, Stripe, MS Graph) → `context7` MCP.
- Live state (versions, vendor changes, CVE) → curl `endoflife.date` or WebSearch per `~/.claude/rules/lookups.md`.
- Browser verification → `~/.claude/rules/browser.md`.

## Stack invariants

- **Bun only.** Foreign lockfiles git-ignored.
- **TanStack Start kept** (existing scaffold).
- **CF Workers deploy.** No long-running Node procs.
- **Airtable backend** (do not migrate to Postgres without explicit decision).
- **No generic OSS CRM fork.** Atomic / Twenty / NextCRM all evaluated, all rejected.

## Don't touch

- Customer xlsx files (`Copy of NGP MASTER LIST - Copy.xlsx`). Gitignored, contains PII.
- `og_database/`, `*.sql.dump`, `*.pgdump` — legacy Lovable Supabase dumps with PII. Never commit.
- `.env`, `.env.local`, `.env.*.local`. Use `wrangler secret put` for production secrets.

## Where to write things

| Type | Location |
|---|---|
| Code | `src/` (created next session) |
| Worker entrypoint | `src/server.ts` (referenced in `wrangler.jsonc`) |
| Airtable client | `src/server/airtable.ts` (planned) |
| Migration scripts | `scripts/` (planned) |
| Vendor doc mirrors | `docs/<lib>/` |
| Field mapping spec | `docs/decisions/06-domain-schema.md` §1 (canonical 83-col → table.field table) |
| Architectural decisions | `docs/decisions/<NN>-<topic>.md` |
| Issues / runbook | `ISSUES.md` (running build log, append findings) |
