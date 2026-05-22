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
| ESI | Electric Service Identifier. TX meter number, prefix `1044…`. Universal key. |
| Mils | Thousandths of a dollar per kWh. Agent commission unit. |
| TCV | Total Contract Value. `Annual Usage × Term yrs × Mils ÷ 1000`. |
| REP | Retail Electric Provider. Supplier on contract. |
| LOA | Letter of Authorization. Required before quoting (In Pricing stage). |
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
| Field mapping spec | `docs/migration/field-map.md` (planned) |
| Issues / runbook | `ISSUES.md` (running build log, append findings) |
