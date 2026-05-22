# HANDOFF — next session start

Last session: 2026-05-22. Planning + architecture decisions. Zero code written.

## State

Repo nuked (`719a7fd chore: nuke everything for rebuild`). Only files present:
- `.env`, `.env.development`, `.env.production` — Supabase + Stripe placeholders
- `.gitignore` — locked down (bun-only, xlsx blocked, og_database blocked)
- `wrangler.jsonc` — CF Worker config, routes for `virecrm.com` + `majix.ai` zones
- `Copy of NGP MASTER LIST - Copy.xlsx` — customer #1's source data (gitignored)
- `README.md` / `CLAUDE.md` / `AGENTS.md` / `TASKS.md` / `HANDOFF.md` — planning docs (this batch)

No `src/`, no `package.json`, no Airtable bases created yet.

## Decisions locked

1. **Customer #1:** greenergiai CEO, TX commercial electricity broker.
2. **Subdomain:** `greenenergiai.virecrm.com`.
3. **Project shape:** B — CRM-as-a-service product. Multi-tenant by subdomain.
4. **Architecture:** SPA (TanStack Start) → CF Worker → Airtable API. See README.
5. **Backend:** Airtable now, Postgres at customer 10-20.
6. **Frontend:** TanStack Start kept (was nuked but stack choice survives).
7. **Auth:** Supabase Auth only — no domain data in Postgres yet.
8. **Bun only.**

## Open questions (need her on a call to answer)

From `TASKS.md` "Open questions for the next call":
1. Renewal workflow today (spreadsheet sort / Outlook flags / calendar reminders?)
2. Commission statements — where they land + reconcile method
3. LOA process — paper / DocuSign / email PDFs
4. Customer portal — MVP or v2 (route already in wrangler)
5. Pricing quote source — own matrix / per-deal REP calls / 3rd-party broker portal
6. Usage data ingest — PDF OCR or manual entry
7. Agent commission splits — house cut?
8. E-sign on contracts
9. Supplier list — fixed dropdown or open
10. Drop tracking needed?

Don't build past Phase 1 schema without answers — too many forks.

## Immediate next steps for the next session

In order:

1. **Inspect xlsx headers.** Open `Copy of NGP MASTER LIST - Copy.xlsx` in a Bun script, dump column names + first 5 rows. Confirms schema fit before any Airtable base creation.
2. **Create Airtable base** `greenergiai` via `mcp__airtable__create_base` in workspace `wspBUTSYGFioquhDD`. Tables per `TASKS.md` Phase 1.
3. **Bootstrap TanStack Start app.** `bunx create-tsrouter-app@latest .` or whatever the current TanStack Start scaffold command is — verify via context7 first.
4. **Wire Worker → Airtable.** Stub `src/server/airtable.ts` with one read function. Verify auth path with PAT.
5. **Hardcode tenant routing.** Worker maps `greenenergiai.virecrm.com` → base ID. Verify with `wrangler dev`.

## Things blocking real work

- **Stripe key still `pk_test_REPLACE_ME`** (`.env.development`). Pull from Stripe dashboard, account `51TYVK6`, test mode.
- **No Airtable PAT yet.** Create scoped PAT (`data.records:read+write`, `schema.bases:read+write`, `webhook:manage`), store via `wrangler secret put AIRTABLE_PAT`.
- **Microsoft Graph app registration not done** (for Outlook). Defer until Phase 5 — don't block earlier work.

## Memory bank reminder

`~/.claude/projects/-Users-darshpoddar-Coding-genesisxsx/memory/MEMORY.md` has older context from earlier sessions referencing Lovable migration + TanStack Start + Supabase. Most still relevant; the "Atomic CRM" / "Twenty" recommendations and earlier Lovable Phase 1 picks are outdated since the architecture pivot to Airtable. Update memory entries during next session as decisions land.

## Caveman audit

These planning docs (`CLAUDE.md`, `AGENTS.md`, `TASKS.md`, `HANDOFF.md`) are caveman style per the writing-style table. `README.md` is full prose (human + agent audience). Don't re-caveman the README.
