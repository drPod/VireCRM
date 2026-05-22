# 10 — Consistency sweep + rephrase prep

**Unit:** 10 of 10. Internal coherence check across the five planning docs at `597ed28 primitive plan`. Not vetting decisions against the outside world — units 1-9 do that. This unit asks: do the docs agree with themselves?

## Verdict (per issue area)

| Area | Verdict | Why |
|---|---|---|
| Atomic CRM scrubbing | **change** | Two live refs in TASKS.md contradict CLAUDE.md "decided against, don't reopen" |
| Kanban native-vs-build | **change** | README says "native Kanban view from Airtable = win"; TASKS.md says "drag-and-drop in custom UI". Pick one, propagate |
| ESI vs Meter Number naming | **tweak** | Already mostly canonical as ESI; one stray "Meter Number" reference in HANDOFF + README sidebar wording |
| Stale "inherited from Lovable" claims | **tweak** | Repo nuked. README + CLAUDE.md still say "inherited from prior Lovable scaffold, kept" |
| Read order disagreement | **tweak** | CLAUDE.md says README → TASKS → HANDOFF (3 docs). AGENTS.md says README → CLAUDE → TASKS → HANDOFF (4 docs). Pick 4-doc order |
| Domain glossary duplication | **tweak** | CLAUDE.md §Domain glossary and AGENTS.md §Domain quick-ref overlap. Canonicalize to CLAUDE.md, link from AGENTS.md |
| Open-questions duplication | **tweak** | TASKS.md owns the 10 questions; HANDOFF.md re-lists them. Link, don't duplicate |
| `.mcp.json` provenance | **tweak** | File exists, untracked, references airtable MCP. Commit it + document in CLAUDE.md tool routing |
| `.env.production` `pk_live_*` | **keep + flag** | Stripe publishable key — safe to commit by Stripe's own guidance, but call it out explicitly so future agents don't panic |
| Caveman drift | **tweak** | CLAUDE.md + AGENTS.md mostly clean. TASKS.md + HANDOFF.md have prose patches. README correctly full-prose |
| Phase 3 reconstruction | **change** | Once Atomic CRM scrubbed + Kanban picked, Phase 3 needs a clean rewrite. Included below |

## Findings catalog

### F1. Atomic CRM contradiction — live refs in TASKS.md

- `CLAUDE.md:33` — "**No Atomic CRM.** Decided against. Don't reopen."
- `CLAUDE.md:23` — Atomic CRM listed under "Rejected and why."
- `CLAUDE.md:58` — "Don't add Atomic CRM, Twenty, NextCRM to deps."
- `TASKS.md:58` — "**Pipeline UI.** Kanban via Atomic CRM's existing board." ← **stale, contradicts CLAUDE.md**
- `TASKS.md:74` — "**Mobile read view.** Atomic CRM is responsive-ish; verify deals + customers readable on phone." ← **stale**
- `AGENTS.md:45` — "**No generic OSS CRM fork.** Atomic / Twenty / NextCRM all evaluated, all rejected." ← correct

**Fix:** scrub both TASKS.md refs. Rewrite Phase 3 (see §Proposed edits / Phase 3 rewrite).

### F2. Kanban native-vs-build ambiguity

- `README.md:97` — "**Fast.** Schema = MCP clicks. Formulas (TCV, renewal-days, rollups) native. **Kanban view native.** Days to her seeing live data, not weeks." → implies Airtable's native Kanban view is a "win" we get for free.
- `TASKS.md:58` — "Kanban via Atomic CRM's existing board. Stages: `Lead → Qualified → In Pricing → Sent → Won → Lost`. **Drag-and-drop between stages.**" → implies we're building custom Kanban in the SPA.
- These cannot both be true. Native Airtable Kanban means iframe-embed or punt customers to airtable.com — but `CLAUDE.md:16` says "Customers never touch airtable.com."

**Decision (recommend Option B):** build custom Kanban in the SPA. Reasons:
1. Embedding airtable.com kills the per-tenant subdomain + branding story (`README.md:25`, single-tenant simplicity principle).
2. Airtable Interface auth is per-Airtable-user; our model is one service PAT held by Worker, customers don't have Airtable seats (`CLAUDE.md:16`).
3. The "Kanban native" claim in README was speed-justification for picking Airtable as **schema/data backend** — the formula engine, the rollups, the views-for-internal-debugging. It was not a claim that the customer-facing UI would be an Airtable iframe. Misread.

**Library pick:** `@dnd-kit/core` (v6.3.1, MIT, React-native-compatible-ish, ~10kB gz, no Atlassian umbrella). Actively maintained — `@dnd-kit/collision` 0.4.0 released 2026-04-13. Alternative: `@atlaskit/pragmatic-drag-and-drop` v1.8.1 (Apache-2.0, Atlassian-maintained, framework-agnostic, lighter at ~5kB). Both active. Recommend dnd-kit because React-idiomatic API (`useSortable`, `DndContext`) — less ceremony to wire a Kanban board than pragmatic-drag-and-drop's adapter pattern. Pragmatic wins on perf for large boards; we won't have large boards (one CEO + a few agents).

Adjust `README.md:97` wording so "Kanban view native" doesn't read as a customer-UI claim.

### F3. Stale "inherited from Lovable" wording

- `CLAUDE.md:18` — "**TanStack Start SPA.** React + Vite + file-based routing + SSR. **Inherited from prior Lovable scaffold, kept.**"
- `README.md:103` — "**Frontend:** TanStack Start (React + Vite + file-based routing + SSR). **Inherited from the prior Lovable scaffold and kept.**"
- `AGENTS.md:42` — "**TanStack Start kept** (existing scaffold)."

Repo was nuked at `719a7fd`. No scaffold exists anymore. The decision survives — "rescaffold with TanStack Start" — but the wording "inherited from prior X" is false today; nothing physical was inherited.

**Fix:** reword to "TanStack Start chosen (was the prior stack pre-nuke; pick survives the rebuild)." or just "TanStack Start. React + Vite + file-based routing + SSR."

### F4. Read order disagreement

- `CLAUDE.md:5-8` — "Read these first, in order: README.md → TASKS.md → HANDOFF.md." (3 docs, **omits CLAUDE.md itself**, which is fine — agent is reading it).
- `AGENTS.md:9-14` — "Read order: README.md → CLAUDE.md → TASKS.md → HANDOFF.md." (4 docs).

Different lists. Not a flat contradiction — CLAUDE.md is telling agents who already opened CLAUDE.md what to read next; AGENTS.md is telling agents what to read at all. But the implicit ordering of CLAUDE.md vs TASKS.md is consistent (CLAUDE before TASKS in AGENTS, agent's-already-in CLAUDE in CLAUDE.md).

**Fix:** leave CLAUDE.md as-is, leave AGENTS.md as-is. They're consistent under the "you're already reading me" interpretation. Add a one-liner to CLAUDE.md explaining the omission, so future agents don't think it's a drift bug.

### F5. Domain glossary duplication

- `CLAUDE.md:35-44` — full bullet list, 10 entries (ESI, Mils, TCV, REP, LOA, Drop, In Pricing, Current Clients).
- `AGENTS.md:20-30` — markdown table, 7 entries (ESI, Mils, TCV, REP, LOA, In Pricing, Current Clients).

Drop + the bullet-vs-table format differ. Two sources for the same facts = drift risk.

**Fix:** canonical home = `CLAUDE.md` (more complete). Replace `AGENTS.md:20-30` block with "Domain glossary: see `CLAUDE.md` §Domain glossary."

### F6. Open-questions duplication

- `TASKS.md:94-105` — full 10-question list with rationale per question.
- `HANDOFF.md:27-39` — same 10 questions, shorter.

Drift risk. If she answers one, both lists need updating.

**Fix:** canonical home = `TASKS.md`. Replace `HANDOFF.md:27-39` with "10 open questions in `TASKS.md` §Open questions. Don't build past Phase 1 schema until answered."

### F7. `.mcp.json` exists but undocumented

- Repo root has `.mcp.json` referencing `https://mcp.airtable.com/mcp` as HTTP server.
- Git status shows it's untracked.
- `CLAUDE.md:65` tool routing says "Airtable schema/data → `mcp__airtable__*` tools" — implies an MCP is configured, but doesn't say where.

**Fix:** commit `.mcp.json` (no secrets in it; just an HTTP URL) so teammates / Cursor / Aider get the same routing. Mention it in `CLAUDE.md` §Tool routing.

### F8. `.env.production` `pk_live_*` Stripe publishable

`.env.production:1` — `VITE_PAYMENTS_CLIENT_TOKEN="pk_live_51TYVK67klyZ9sPrQCN6wkrtXq63fD8w7KgzIzHXLwm4ZGFFAN1Es0JpzfiGUBFwTju0uXifrqi4710k4rmAMktWZ00atJrTkPq"`

Stripe's `pk_live_*` is the **publishable** key — Stripe explicitly says these are safe to commit and ship to browser. The dangerous one is `sk_live_*` (secret) which is correctly held via `wrangler secret put STRIPE_SECRET_KEY` per `CLAUDE.md:82`.

**Fix:** **no security issue** — but the docs should call this out explicitly so future agents (or audit bots) don't open a panic PR. Add a comment block to `.env.production` and a note in CLAUDE.md secrets section.

### F9. ESI vs "Meter Number" naming

Repo is mostly canonical on "ESI." One drift point:

- `README.md:43` (xlsx table row) — uses "**ESI Number** | Electric Service Identifier — the Texas meter number, mostly prefixed `1044...`" — correct framing (industry term = ESI, casual term = meter number).
- `README.md:79` — "Build an **Outlook integration**" — unrelated.
- `HANDOFF.md` does not mention "Meter Number" — ✓
- `AGENTS.md:24` — "Electric Service Identifier. TX meter number, prefix `1044…`." — correct.

**Decision:** ESI is canonical everywhere in code + schema + UI labels. xlsx import script should accept column-header aliases (`Meter Number`, `ESI`, `ESI Number`, `ESIID`) and normalize to `ESI` internally. The xlsx itself probably says "ESI Number" or "Meter Number" — confirm at xlsx-inspect time (Phase 2 first step).

**Fix:** add a sentence to `CLAUDE.md` §Domain glossary clarifying "schema/UI = ESI; xlsx column-header aliases tolerated at import time."

### F10. Caveman-style drift

Per `~/.claude/CLAUDE.md` writing-style table: CLAUDE.md, AGENTS.md, TASKS.md, HANDOFF.md → caveman. README.md → full prose.

Audit:
- `CLAUDE.md` — mostly caveman. Some full sentences in §Architecture bullets and §Why-rejected list (acceptable; they're justification, not enforced rules).
- `AGENTS.md` — clean caveman.
- `TASKS.md` — mixed. Conventions block (lines 7-9) caveman ✓. Phase descriptions lean full-prose ("One-time launch task — not a recurring user-facing import UI"). Marginal; the prose adds clarity and isn't egregious. Leave.
- `HANDOFF.md` — mostly caveman, occasional full sentences in "Things blocking real work." Marginal. Leave.
- `README.md` — full prose ✓. Correctly verbose for human audience.

**Fix:** no aggressive recaveman pass needed. The current balance reads well. HANDOFF.md "Caveman audit" footer (lines 63-66) is meta-noise — delete; the project-level rule already lives in `~/.claude/CLAUDE.md`. Don't put rules-about-rules in HANDOFF.

### F11. Cross-doc redundancy beyond glossary + open-questions

Other facts repeated across docs:

| Fact | Repeated in | Recommended canonical home |
|---|---|---|
| Architecture one-liner `SPA → Worker → Airtable` | CLAUDE.md:13, AGENTS.md:18, README.md:88-93, HANDOFF.md:21 | README.md (the diagram). Others link with one-line summary. |
| "Bun only" | CLAUDE.md:30, AGENTS.md:41, HANDOFF.md:25 | CLAUDE.md §Stack invariants. Others reference. |
| Airtable workspace ID `wspBUTSYGFioquhDD` | CLAUDE.md:16,65, AGENTS.md:34, TASKS.md:24, HANDOFF.md:48 | Acceptable repetition — short, factual, no drift risk. |
| Webhook 7-day expiry | CLAUDE.md:52, TASKS.md:43 | TASKS.md (it's an actionable cron task). CLAUDE.md mentions in conventions, fine. |
| Stripe account `51TYVK6` | README.md:107, HANDOFF.md:55, TASKS.md:15, CLAUDE.md maintainer notes:75 | CLAUDE.md maintainer notes (HTML comment). Others reference "see CLAUDE.md secrets." |
| `pk_test_REPLACE_ME` blocker | HANDOFF.md:55, TASKS.md:15, .env.development:1 | TASKS.md Phase 0 (it's a task). HANDOFF.md repeats acceptably. |

### F12. Sequencing claims

- `TASKS.md:35` — "**Sanity-check schema** with Darsh before importing data." References Darsh = author, fine.
- `TASKS.md:50` — "Inspect xlsx headers ... confirm column→table mapping with Darsh before any write." Phase 2 says inspect-then-map. `HANDOFF.md:47` puts xlsx inspection as immediate next step #1.
- `HANDOFF.md:46-51` — orders next steps inspect-xlsx → create-airtable-base → bootstrap-TanStack → wire-Worker → tenant-routing. But `TASKS.md` Phase 0 lists Stripe-key + PAT + tenant-routing + TanStack-bootstrap, then Phase 1 schema, then Phase 2 xlsx.

Sequencing mismatch: HANDOFF says **inspect xlsx FIRST** (before creating Airtable base) so schema fits the data. TASKS.md Phase 1 (create base) precedes Phase 2 (inspect xlsx). The HANDOFF order is the right one — inspect data before locking schema.

**Fix:** add a `Phase 0.5 — Inspect xlsx` to `TASKS.md` between Phase 0 and Phase 1. Move "Parse xlsx headers + first 20 rows" from Phase 2 to Phase 0.5. Keeps Phase 2 as "the actual migration script run after schema is locked."

### F13. TASKS.md Phase 1 mentions LOAs table; LOA gate is in Phase 4

- `TASKS.md:26` (Phase 1) — Customers table "linked → LOAs."
- `TASKS.md:32` (Phase 1) — `LOAs` table created.
- `TASKS.md:71` (Phase 4) — "**LOA gate.** Block 'In Pricing' stage transition unless customer has a non-expired LOA on file."

Phase 1 creates the table, Phase 4 enforces the gate. Coherent. No fix.

### F14. Missing — `og_database/` referenced in .gitignore + AGENTS.md but never explained

- `.gitignore:72-77` — blocks `og_database/`, `*.sql.dump`, `*.pgdump`.
- `AGENTS.md:50` — "`og_database/`, `*.sql.dump`, `*.pgdump` — legacy Lovable Supabase dumps with PII. Never commit."
- Comment in .gitignore says "See ISSUES.md 'Lovable → fixed-DB data migration' Open item." But there is no `ISSUES.md` in the repo at `597ed28` — that's a stale reference to a file from before the nuke.

**Fix:** either remove the `ISSUES.md` cross-ref from `.gitignore` comment, or note in `HANDOFF.md` that ISSUES.md will be reseeded when build starts (per the global memory note "ISSUES.md is the running build log").

### F15. `customers.virecrm.com` route in wrangler — referenced but ambiguous

- `wrangler.jsonc:34` — `{ "pattern": "customers.virecrm.com/*", "zone_name": "virecrm.com" }`
- `README.md:118` — "Customer-facing portal. `customers.virecrm.com` route already exists in `wrangler.jsonc` — implies prior intent."
- `TASKS.md:99` (open Q4) — "Customer-facing portal — MVP or v2?"

The route exists, but no decision has been made about scope. Acceptable — it's flagged as an open question. No fix.

### F16. "Migration plan" timing — customer 10 vs 20

- `CLAUDE.md:20` — "**Migration plan.** Airtable → Postgres at customer 10-20 or first scaling pain."
- `README.md:85` — "migrate to Supabase Postgres at customer 10-20 (or first scaling pain)."
- `HANDOFF.md:23` — "Backend: Airtable now, Postgres at customer 10-20."

Consistent. No fix.

### F17. Field naming — `Mils` vs `Agent Mils`

- `CLAUDE.md:38` — "**Mils** — thousandths of a dollar per kWh."
- `CLAUDE.md:39` — TCV formula uses "**Agent Mils**."
- `README.md:46` — xlsx column "**Mils**."
- `README.md:67` — "the agent records their **agent mils**."
- `TASKS.md:29` — Contracts table field "Agent Mils."

Casual "mils" = unit. Schema field name = `Agent Mils` to distinguish from any future `House Mils` / supplier-side mils. Consistent enough. No fix.

### F18. README §Stack mentions `customers.virecrm.com` but README §Architecture says `greenenergiai.virecrm.com`

- `README.md:5` — deployed at `greenenergiai.virecrm.com`.
- `README.md:88` — diagram top: `greenenergiai.virecrm.com (TanStack Start SPA)`.
- `README.md:108` — "Wildcard `*.virecrm.com/*` carries the tenant subdomains."
- `README.md:118` — `customers.virecrm.com` is a separate, customer-facing route.

Architecture: `greenenergiai.virecrm.com` = the tenant's admin UI (agents/CEO log in). `customers.virecrm.com` = end-customers (the broker's clients) log in to see their meters. Different audiences. The docs imply this but don't state it.

**Fix:** add one line to README clarifying the two-audience model: tenant agents at `<tenant>.virecrm.com`, end-customers at `customers.virecrm.com`.

### F19. `.gitignore` `.claude/*` block — `.mcp.json` lives at repo root, not `.claude/`

`.gitignore:54-57` blocks `.claude/*` (with exceptions for `.claude/skills/`, `.claude/hooks/`, `.claude/settings.json`). `.mcp.json` is at repo root — outside the `.claude/` rule. So committing `.mcp.json` (per F7) won't conflict with the .gitignore rule. ✓

### F20. `nodejs_compat` flag — implies Node-style code in Worker

`wrangler.jsonc:6` — `"compatibility_flags": ["nodejs_compat"]`. Worker uses Node compat. README/CLAUDE.md don't mention. Not a contradiction — Workers can mix Node-compat shims with the standard Worker runtime — but worth noting in CLAUDE.md so agents don't write code assuming pure Workers globals only (or vice versa).

**Fix (optional):** one line in CLAUDE.md §Stack invariants: "Worker runs with `nodejs_compat` — node:buffer / node:crypto importable; check `wrangler.jsonc` before adding new node imports."

### F21. Bunx scaffold command in HANDOFF — unverified

`HANDOFF.md:49` — "`bunx create-tsrouter-app@latest .` or whatever the current TanStack Start scaffold command is — verify via context7 first."

Self-flagged as needing verification. Honest, but the agent should resolve this before "next session." Recommend: have unit 1/3 (whichever vets TanStack Start) confirm the actual command. Not this unit's job.

## Naming canonicalization decisions

| Term | Canonical | Aliases tolerated at | Notes |
|---|---|---|---|
| ESI | `ESI` (schema field), `ESI Number` (xlsx-import alias only) | xlsx column headers | Casual UI label = "ESI" or "Meter (ESI)." Never "Meter Number" alone in our UI. |
| Mils (unit) | `mils` | — | lowercase as unit |
| Agent Mils (field) | `Agent Mils` | `Mils` (xlsx alias) | schema-field PascalCase |
| TCV | `TCV` everywhere | "Total Contract Value" on first mention | |
| REP | `REP` in schema | "Supplier" acceptable in UI copy | xlsx column is "Supplier"; schema FK is REPs table |
| LOA | `LOA` | — | acronym in glossary on first use |
| In Pricing | `In Pricing` (stage name, two words, capitalized) | — | locked stage label |
| Current Clients | `Current Clients` (tab name) | — | |
| Drop | `dropped` (status) | — | verb-form in status field, noun-form in glossary |
| Tenant subdomain | `<tenant>.virecrm.com` | — | tenant = e.g. `greenenergiai` |
| Customer portal | `customers.virecrm.com` | — | end-customer = broker's client |

## Cross-doc redundancy plan

| Fact | Canonical source | Linkers |
|---|---|---|
| Architecture diagram | `README.md` §Architecture | `CLAUDE.md`, `AGENTS.md`, `HANDOFF.md` — one-line summary + link |
| Domain glossary | `CLAUDE.md` §Domain glossary | `AGENTS.md` — link only |
| Why-rejected list (Atomic / Twenty / NextCRM / pure-Supabase) | `CLAUDE.md` §Architecture | `AGENTS.md` — one-liner + link |
| Stack invariants | `CLAUDE.md` §Stack invariants | `AGENTS.md` — one-liner + link |
| Tool routing | `CLAUDE.md` §Tool routing | `AGENTS.md` — same table, ok to dup (small + stable) |
| Build backlog | `TASKS.md` | `HANDOFF.md` — "see TASKS.md §Phase N" |
| Open questions for next call | `TASKS.md` §Open questions | `HANDOFF.md` — link + "answer before Phase 1" |
| Immediate next steps | `HANDOFF.md` §Immediate next steps | — |
| Decisions locked | `HANDOFF.md` §Decisions locked | — (snapshot, may drift; refresh per session) |
| Maintainer secrets (Supabase project ID, Stripe account, CF zones) | `CLAUDE.md` maintainer-notes HTML block | — (visible to humans via Read, stripped from agent context) |
| What-NOT-to-do | `CLAUDE.md` §What to NOT do | `AGENTS.md` §Don't touch — physical file list only, link to CLAUDE.md for full list |

## Proposed agent-file edits

### CLAUDE.md

**Replace line 18:**

```
- **TanStack Start SPA.** React + Vite + file-based routing + SSR. Inherited from prior Lovable scaffold, kept.
```

with:

```
- **TanStack Start SPA.** React + Vite + file-based routing + SSR. Pick survives the pre-rebuild stack; rescaffolded fresh.
```

**Insert after line 8 (Read order block):**

```
(CLAUDE.md not in the list — you're already reading it. Order assumes agent opened CLAUDE.md first, then walks the rest.)
```

**Append to line 44 (after "Drop" glossary entry):**

Add note about xlsx-import alias tolerance:

```
**xlsx-import aliases:** column-header text on her sheet may say "Meter Number" / "ESIID" / "ESI" — import script normalizes to `ESI`. Canonical name in schema + UI = `ESI`.
```

**Replace line 65-69 (Tool routing) — add `.mcp.json` mention:**

```
## Tool routing

- **Airtable schema/data** → `mcp__airtable__*` tools. Workspace `wspBUTSYGFioquhDD`. MCP server config in `.mcp.json` (HTTP transport, `mcp.airtable.com/mcp`).
- **Lib docs** (TanStack Start, Wrangler, Supabase JS, Stripe Node) → `context7` MCP.
- **Cross-repo search** → delphi.
- **Browser verification** → see `~/.claude/rules/browser.md`.
- **Live state** (Node LTS, Airtable API changes, Stripe API versions) → curl endoflife / WebSearch per `~/.claude/rules/lookups.md`.
```

**Append to line 84 (after `.env.example` line):**

```
- `.env.production` ships `pk_live_*` Stripe **publishable** key — safe to commit per Stripe's own guidance. Secret key (`sk_live_*`) NEVER in this file; `wrangler secret put STRIPE_SECRET_KEY` instead.
```

**Append to §Stack invariants (after line 33):**

```
- **Worker runs with `nodejs_compat`.** `node:buffer` / `node:crypto` importable in Worker code. Check `wrangler.jsonc` before adding node imports — don't assume pure Workers runtime.
```

### AGENTS.md

**Replace lines 20-30 (Domain quick-ref table):**

```
## Domain glossary

See `CLAUDE.md` §Domain glossary for canonical definitions of ESI / Mils / TCV / REP / LOA / Drop / In Pricing / Current Clients.
```

**Replace line 42:**

```
- **TanStack Start kept** (existing scaffold).
```

with:

```
- **TanStack Start.** React + Vite + file-based routing + SSR. Rescaffold fresh per `HANDOFF.md`.
```

### README.md

**Replace lines 95-99 (the "Why this hits fast" block):**

```
Why this hits fast + Project B + reversible:

- **Fast.** Schema = MCP clicks. Formulas (TCV, renewal-days, rollups) native. Kanban view native.  ← *as a debugging/admin view for us; customer-facing Kanban is built in the SPA with `@dnd-kit/core`.* Days to her seeing live data, not weeks.
- **Project B.** Custom frontend keeps brand + URL + per-tenant routing. Customer never touches airtable.com.
- **Reversible.** Worker abstracts Airtable. Migration day = swap one module. Frontend unchanged.
```

**Replace line 103:**

```
- **Frontend:** TanStack Start (React + Vite + file-based routing + SSR). Inherited from the prior Lovable scaffold and kept.
```

with:

```
- **Frontend:** TanStack Start (React + Vite + file-based routing + SSR). Same stack the repo had pre-nuke; rescaffolded fresh in the rebuild.
```

**Append a new sentence to §Architecture (after the diagram, line 93):**

```
Two audiences, two subdomain shapes:
- `<tenant>.virecrm.com` (e.g. `greenenergiai.virecrm.com`) — the broker's internal admin UI: CEO + agents working deals.
- `customers.virecrm.com` — end-customers (the broker's clients) logging in to see their own meters, contracts, rates. Scope TBD per open-questions.
```

### TASKS.md — Phase 3 rewrite (FULL)

**Replace lines 56-61** (current Phase 3) with:

```markdown
## Phase 3 — Pipeline + tabs `[stated]`

- [ ] **Pipeline UI.** Custom Kanban board in the SPA, columns = pipeline stages. Library: `@dnd-kit/core` (React, MIT, ~10kB gz). Stages locked at `Lead → Qualified → In Pricing → Sent → Won → Lost`. Drag-and-drop between columns; drop = stage write to Worker → Airtable. Optimistic UI; reconcile on response.
- [ ] **"In Pricing" tab.** Filtered route showing deals in `In Pricing` stage only. One card per deal — customer, ESI(s), supplier candidates being quoted, target close date.
- [ ] **"Current Clients" tab.** Filtered route showing customers with at least one `active` contract. Per-customer expand: all ESIs, supplier, contract dates, ¢/kWh, mils, TCV. Multi-meter accounts render as one customer row with N ESIs underneath.
- [ ] **Close-deal flow.** When deal → `Won`: modal prompts for agent mils + contract end date, Worker computes TCV (Airtable formula confirms), attaches Contract to ESI(s), customer auto-graduates into Current Clients. Idempotent — replay-safe (Airtable has no transactions).
- [ ] **Mobile read view.** Custom SPA Kanban responsive-tested on phone-width breakpoints (Playwright + 375px viewport). Read-only on mobile is fine for v1; full editing desktop-only.
```

**Replace line 15 (Phase 0 Stripe item) — add Stripe publishable-key clarification:**

```
- [ ] **Stripe test-key replacement.** `VITE_PAYMENTS_CLIENT_TOKEN` in `.env.development` = `pk_test_REPLACE_ME`. Pull live test publishable key from Stripe dashboard (account `51TYVK6`, test mode, Developers → API keys → Publishable). `.env.production` already has live publishable key (`pk_live_*` — safe to commit per Stripe). Secret keys NEVER in `.env` — `wrangler secret put STRIPE_SECRET_KEY`.
```

**Insert new Phase 0.5 between Phase 0 and Phase 1 (after line 19):**

```markdown
## Phase 0.5 — Inspect xlsx before locking schema

Schema is reversible but expensive to redo once data is in. Look at the actual data first.

- [ ] **Bun script to inspect `Copy of NGP MASTER LIST - Copy.xlsx`.** Dump every column header. Dump first 20 rows. Print distinct values for columns that look like enums (Supplier, Stage, Status). Print row count.
- [ ] **Column → Airtable-table.field mapping draft.** In `docs/migration/field-map.md`. Mark uncertain columns (e.g. `Notes` may be free-form or structured; check).
- [ ] **Confirm mapping with Darsh** before any base creation.
```

**Move xlsx-inspection bullet out of Phase 2.** Phase 2 line 50 currently says "Parse `Copy of NGP MASTER LIST - Copy.xlsx` in a Bun script. Inspect headers, dump first 20 rows..." — that work now lives in Phase 0.5. Phase 2 becomes purely the migration-run script:

```markdown
## Phase 2 — One-shot xlsx migration `[stated]`

One-time launch task — not a recurring user-facing import UI. Run once, she sees her data live. Assumes Phase 0.5 done (schema fits the data).

- [ ] **Field-map locked.** `docs/migration/field-map.md` reviewed + signed off.
- [ ] **Migration script.** Idempotent. Reads xlsx, normalizes (ESI string with `1044…` prefix kept; dates ISO 8601; dollar/cent amounts in cents-int), writes via Airtable API in batches of 10 (respects 5 req/sec ceiling). Logs row-by-row "what failed and why."
- [ ] **Dry-run mode.** `--dry-run` flag prints what would write without writing. Required first pass.
- [ ] **Spot-check 5 customer records in UI** before declaring import done.
- [ ] **Backfill two years of historical clients** via same script.
```

### HANDOFF.md

**Replace lines 27-39 (Open questions block):**

```
## Open questions (need her on a call to answer)

10 open questions for the next call live in `TASKS.md` §Open questions. Don't build past Phase 1 schema until answered.
```

**Replace lines 47-51 (Immediate next steps) — align with Phase 0.5 insertion:**

```
1. **Inspect xlsx headers** (Phase 0.5). Bun script opens `Copy of NGP MASTER LIST - Copy.xlsx`, dumps column names + first 20 rows + distinct enum values. Confirms schema fit before any Airtable base creation.
2. **Draft field map** (`docs/migration/field-map.md`), get Darsh sign-off.
3. **Create Airtable base `greenergiai`** via `mcp__airtable__create_base` in workspace `wspBUTSYGFioquhDD`. Tables per `TASKS.md` Phase 1.
4. **Bootstrap TanStack Start app.** Verify scaffold command via context7 (TanStack Start lib resolve). Bun-only.
5. **Wire Worker → Airtable.** Stub `src/server/airtable.ts` with one read function. Verify auth path with PAT.
6. **Hardcode tenant routing.** Worker maps `greenenergiai.virecrm.com` → base ID. Verify with `wrangler dev`.
```

**Delete lines 63-66 (Caveman audit footer):**

The writing-style rule lives in `~/.claude/CLAUDE.md` — don't restate.

### .env.production

**Insert comment at top (before line 1):**

```
# VITE_PAYMENTS_CLIENT_TOKEN is the Stripe PUBLISHABLE key (pk_live_*).
# Stripe explicitly says publishable keys are safe to ship to browsers + commit.
# Reference: https://docs.stripe.com/keys#obtain-api-keys
# The secret key (sk_live_*) is NEVER in this file — set via `wrangler secret put STRIPE_SECRET_KEY`.
```

### .mcp.json

**Commit as-is.** Already valid + minimal. Just `git add .mcp.json`.

### .gitignore

**Optional fix to line 74:**

```
# See ISSUES.md "Lovable → fixed-DB data migration" Open item.
```

reword to:

```
# Legacy from pre-nuke Lovable Supabase migration. ISSUES.md (running build log)
# will be reseeded in the rebuild; this comment is a forward-reference.
```

## Out of scope

Noticed but deliberately not fixing in this unit:

1. **TanStack Start scaffold command (`bunx create-tsrouter-app@latest`).** Self-flagged in `HANDOFF.md:49` for verification. Unit vetting TanStack Start (different unit) owns this lookup.
2. **`compatibility_date` in wrangler.jsonc.** Set to `2026-05-17` — within the project's lifetime. Unit vetting CF Workers infra (different unit) owns whether this needs bumping.
3. **Whether to fork `og_database/` policy.** Existed pre-nuke per `.gitignore` comment. No code references it; PII concern stays valid; leave the gitignore rule.
4. **Maintainer-notes HTML stripping.** `CLAUDE.md:73-80` correctly uses `<!-- ... -->` per global rule. Verified — no fix needed.
5. **The whole architecture decision (Airtable backend).** Other units vet this. This unit only checks that the docs agree on the decision (they do, after fixes above).
6. **Outlook integration scope.** Phase 5 is a separate vetting unit's territory.
7. **`virecrm.com` vs `majix.ai` zone dual-routing.** wrangler.jsonc handles. Strategic decision — not a docs-consistency issue.
8. **`@dnd-kit/core` vs `@atlaskit/pragmatic-drag-and-drop` final pick.** Recommended dnd-kit; the unit vetting frontend libs can second-guess. Both are actively maintained in 2026 per npm/GitHub.

## Notes for the merge

If multiple vetting units (1-9) propose conflicting edits to the same lines, this unit's edits are the **lowest priority** — vetting unit edits the decision, this unit edits the wording. Apply vetting-unit edits first, then re-run this unit's consistency check.
