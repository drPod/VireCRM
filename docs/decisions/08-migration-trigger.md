# 08 — Migration trigger + reversibility claim

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

> **Unit:** 08 of 10 in the vet pass. Vetting the Airtable → Postgres migration plan locked into `README.md` (lines 85, 99, 106) and `CLAUDE.md` (§Architecture).
> **Date:** 2026-05-22.
> **Author:** parallel subagent, reporting to main vet loop.

## Claim under review

The current planning docs make two coupled assertions:

- **Part A — Trigger (when).** "Airtable → Postgres at customer 10-20 (or first scaling pain)" — `README.md:85`, `CLAUDE.md` §Architecture, `HANDOFF.md` §Decisions locked #5.
- **Part B — Reversibility (cost).** "Worker abstracts Airtable. Migration day = swap one module. Frontend unchanged." — `README.md:99`. Implicit claim: 1-week job, not 1-quarter.

## Verdict

**Split.**

- **Trigger (Part A) — keep, but reframe.** "Customer 10-20" is the wrong axis. The real walls are *per-tenant*: per-base record limit (50K Team / 125K Business / 500K Enterprise) and the per-table 100K hard cap that applies on every tier. ([Whalesync][whalesync], [Airtable Plans][plans], [CriticNest][criticnest]) At ~5,500 deal rows today and growing per-closed-deal, customer #1 alone could brush the Team-tier 50K wall in a few years if the historical-clients backfill plus future deals stack into a single `Contracts` or `Deals` table. Trigger should fire on **per-tenant table size**, not on customer count.
- **Reversibility (Part B) — tweak hard.** "Swap one module" is true for the *Worker* file boundary, but the unstated work is: data migration script, formula-field re-implementation, attachment re-host, view re-creation in app layer, dual-write window, cutover validation. Realistic estimate is **3-5 weeks**, not 1 week. README should say so out loud; otherwise the calmness of "swap one module" reads as a promise we will not keep when the day comes.

## Evidence

### A1. Airtable plan walls (verified May 2026)

| Plan | $/seat/mo | Records/base | Records/table | API rate (per base) | Attachment storage |
|---|---|---|---|---|---|
| Free | 0 | 1,000 | (capped by base) | 5 req/sec | 1 GB |
| Team | $20 (annual) | 50,000 | **100K hard cap, all tiers** | 5 req/sec | 20 GB |
| Business | $45 (annual) | 125,000 | 100K | 5 req/sec | 100 GB |
| Enterprise Scale | custom | 500,000 | 100K | 5 req/sec | 1 TB |

Sources: [Airtable pricing page][airtable-pricing], [Plan overview][plans], [Rate limits doc][ratelimits], [Whalesync explainer][whalesync], [CriticNest analysis][criticnest].

**Key uncomfortable facts:**

1. The **5 req/sec per-base ceiling does not scale with plan**. Enterprise pays $custom and still gets 5 req/sec. ([Rate limits doc][ratelimits], [community confirmation][community-rate]). The rate-limit wall is therefore *never* solved by upgrading Airtable plans. Only by leaving Airtable.
2. **Per-table cap of 100K applies on every tier**, including Enterprise's 500K base limit ([CriticNest][criticnest], [Whalesync][whalesync]). A single `Contracts` table with full history will hit 100K well before a single base hits 125K, forcing internal sharding (split table → linked sub-tables) on a *single* tenant before customer 10.
3. Hitting the limit makes the base **read-only for new writes**, with a few hours of lag before the warning lifts after deletes ([Switchlabs][switchlabs], [Whalesync][whalesync]). Not graceful.

### A2. "Customer 10-20" framing is wrong

Each customer is its own base. So customer count drives *workspace base count*, not per-base record count. Workspaces on paid tiers allow unlimited bases ([Airtable plans][plans]). The actual binding constraints are:

| Bottleneck | Per | Plan-scalable? |
|---|---|---|
| Records/base | per tenant | yes (50K → 125K → 500K) |
| Records/table | per tenant | **no** (100K hard cap all tiers) |
| API req/sec | per tenant base | **no** (5 req/sec all tiers) |
| Workspace base count | per workspace | yes (unlimited on paid) |
| Cost per seat | n/a (single service PAT model) | n/a — flat |

The trigger that bites first depends on which tenant grows fastest, not how many tenants exist. A single high-volume customer (lots of meters, lots of historical contracts) brushes the per-table cap before a 15-customer roster brushes anything.

**Cost economics: the trigger is *not* cost.** With single-service-PAT model (customers never get an Airtable seat), spend is flat at one Business seat (~$45/mo) for the workspace owner. Adding customer #20 adds zero Airtable seats. Cost-driven migration pressure is therefore nil — only the technical walls force the move.

### A3. Where customer #1 (greenergiai) actually lands

Current size from `TASKS.md` backfill scope: ~5,500 active rows, plus "two years of historical clients" backfill. Rough math:

- Customers ~500-1,000
- Service addresses ~1.2× customers ≈ 1,000-2,000
- ESIs ~1× addresses ≈ 1,000-2,000
- Contracts (1 per ESI × years of history) ≈ 4,000-8,000 over 2-3 years
- Deals (historical pipeline + future) ≈ 2,000-5,000
- LOAs / Commission Statements ≈ 500-2,000 each

Total per-base records: **5K-20K initially, projected 30-50K within 3 years of operation**. Comfortably inside Team-tier 50K, but the *Contracts* table specifically will be the per-table watchwall — if every meter accrues a new contract each renewal cycle, that's 1-2K new rows/year per customer. Tenant #1 alone hits the 100K table cap in ~50 years on its own growth, but only because the dataset is small. Tenants with thousands of meters compress that fast.

### A4. Actual triggers — restate

Replace "customer 10-20" with calendar-monitored thresholds:

1. **Any tenant base ≥ 40,000 records** → migrate that tenant proactively (80% of Team-tier cap).
2. **Any single table in any tenant ≥ 80,000 rows** → migrate (80% of 100K hard cap, no plan upgrade fixes it).
3. **Sustained API rate-limit pressure** — Worker logs `429` retries > X/day for any tenant → migrate.
4. **First "wait, Airtable was down" Slack from a customer** — operational availability is a feature, and Airtable downtime is non-trivial ([Yaxify on availability][yaxify]).
5. **First customer who needs sub-second writes** (instrumentation, IoT-like meter feeds) → Postgres up front for that tenant, hybrid stack.

This is a monitor-then-act trigger, not a count-then-act trigger. Add as a Worker metric.

---

### B1. "Swap one module" — feature-by-feature cost table

Each row is a specific thing Airtable does today that has to be reproduced in Postgres-land. Hours are honest estimates for one engineer who knows the codebase; double them if you don't.

| Airtable feature in use | Postgres replacement | Hours | Risk |
|---|---|---|---|
| **Schema (8 tables)** | Postgres tables, FKs from linked-record fields, enums for single-select | 6-10 | low — straightforward DDL |
| **TCV formula** (own-row math) | `GENERATED ALWAYS AS (annual_usage * term_months / 12 * agent_mils / 1000.0) STORED` ([PG docs][pg-generated]) | 2 | low — own-row math is immutable |
| **Term-months formula** (date arithmetic) | Generated column, immutable date subtraction is fine | 1 | low |
| **Rollup formulas** (e.g. customer total open TCV across contracts) | Materialized view + refresh, or app-layer sum on read, or trigger-maintained denorm column | 6-10 | medium — must pick & implement; refresh cadence vs read-staleness |
| **Linked records (Customer ↔ ServiceAddress ↔ ESI ↔ Contract ↔ Deal)** | FK columns + indexes; data-migration script must resolve Airtable record IDs → Postgres UUIDs in dependency order | 10-16 | medium — order-of-insert bug class |
| **Single-select fields** (Stage, Status, Supplier) | Postgres `CHECK` enums or lookup tables; Supplier becomes proper `reps` table | 4-6 | low |
| **Multi-select fields** (if any added in v1) | Junction table per | 2-4 each | low |
| **Attachments** (LOA PDFs, Commission Statements) | R2/S3 bucket; download from Airtable, re-upload, store URL/key in row; sign-on-read | 12-20 | medium — bandwidth + URL re-write + audit that nothing references stale Airtable file URLs |
| **Webhooks** (push from Airtable to Worker on row change) | Postgres `LISTEN/NOTIFY` ([PG NOTIFY docs][pg-notify]) + Worker subscriber, OR row triggers writing to a `change_events` table polled by Worker, OR CDC (logical replication) | 8-12 | medium — different model; Worker cold-start vs persistent listener |
| **Webhook 7-day refresh cron** | Delete the cron — Postgres notify doesn't expire | -2 (savings) | n/a |
| **Kanban view** (Deals by Stage) | Build in frontend: query `deals where stage=X group by stage`, drag-drop updates `stage` column | 8-16 | low — straightforward UI, frontend already has TanStack components |
| **Filtered views** ("In Pricing" tab, "Current Clients" tab) | SQL queries, parameterized in Worker | 2-4 | low |
| **Airtable Interface forms / record-detail views** | Pre-existing TanStack Start pages (we own the frontend) | 0 | n/a — we already replaced these |
| **Airtable native sync from other bases** | n/a — not used | 0 | n/a |
| **Idempotency on `closeDeal` flow** (already in plan per `CLAUDE.md`) | Same logic, Postgres transaction makes it cheaper/safer | -2 (savings) | low — actually easier |
| **Data migration script** (ETL from each tenant base into Postgres schema) | Bun script, paginated reads at 5 req/sec, batch inserts, link resolution pass | 16-24 | high — biggest single line item; row-by-row error reporting needed |
| **Dual-write window** (Worker writes to both Airtable + Postgres during cutover) | Worker change inside the `airtable.ts` module | 8-12 | medium — must be reversible per tenant |
| **Cutover validation** (count rows, spot-check 20 customers/tenant, verify TCV sums match within $0.01) | Diff scripts | 6-10 | medium — finding silent drops is the whole game |
| **Worker `airtable.ts` swap-out** (the literal "one module") | Replace module body with Postgres client (`pg` over Hyperdrive — [CF Workers + Supabase][cf-supabase]) | 8-12 | low IF interface stayed honest |
| **RLS in Postgres** (Worker enforces today; Postgres can too) | Optional belt-and-suspenders Postgres RLS policies keyed on `tenant_id` | 6-10 | low — but cheap to add and pays back forever |
| **Per-tenant isolation model** (base-per-tenant in Airtable → tenant_id column or schema-per-tenant in Postgres) | Choose model, implement; recommend `tenant_id` column with RLS, simpler than schema-per-tenant | 4-6 | medium — has architectural ripple |
| **Migration runbook + rollback plan** | Doc | 4-6 | low — but needed |

**Subtotal:** ~115-180 hours = **3-4.5 weeks for one engineer** at productive pace, before slippage. With slippage and the inevitable "oh, that field also has a formula" surprises, 4-6 weeks is honest.

**Cloudflare-specific footnote:** the data-migration script can't run *inside* the Worker — Workers have a 30s default / 5min max CPU limit ([CF Workers limits][cf-limits], [higher limits changelog][cf-cpu-changelog]). The migration script lives outside (Bun local, or CF Queues handler with no CPU cap). Doesn't break anything, but it's not literally "swap one Worker module and you're done" — it's "swap the module + run a separate ETL pass + cutover dance per tenant."

### B2. What the "1 week" claim misses

The README line "Migration day = swap one module. Frontend unchanged." is honest about the *frontend* (true — Worker hides Airtable, frontend never noticed) but is misleading about the *data move*. The frontend stability claim is not the same as a one-week migration. The implicit chain is:

> Worker abstracts Airtable → therefore migration is small.

Only the *interface* is small. The data move is its own project.

### B3. Comparable cases (cited)

- **Glide → "Migrate from Airtable to PostgreSQL"** ([Glide blog][glide]). "Open heart surgery" framing. CornerUp hit automation-run limits, lost orders, did a phased move. No clean hour count, but explicit phased-not-big-bang advice. Author emphasis: "begin migration *before* completely outgrowing Airtable, as the work becomes exponentially harder under pressure."
- **Medium "Building a Production Data Pipeline"** ([medium-pipeline]). Real practitioner notes: column-mapping dictionary becomes a living document, character encoding bites, automatic schema discovery seemed elegant but explicit mapping was the win.
- **Airtable's own internal architecture** ([LinkedIn — Airtable migrated to MySQL 8.0][airtable-mysql]). Airtable themselves do not use Airtable as their backend at scale — they use sharded MySQL. The platform vendor's own choice is the strongest "Airtable isn't the destination" signal.
- **Airtable-migration-audit tool** ([GitHub mperlak][audit-tool]). Flags formulas + rollups + linked records + automations + attachments as the hard parts. Confirms the categories in B1.
- **CloseFuture Supabase migration guide** ([closefuture]). Phased, dual-write, "workflows break with every schema change" warning.

### B4. Cutover strategy

Three options, ranked:

1. **Per-tenant rolling, dual-write window** (recommended). Worker writes to *both* Airtable and Postgres for tenant X during cutover; reads go to Airtable until validation passes; flip read-source per tenant; one tenant at a time; tenants stay isolated. This is the strangler-fig variant for our shape ([strangler-fig pattern docs][strangler], [AWS guidance][aws-strangler]). Adds ~8-12h to the cost above per the table.
2. **Snapshot-and-switch** (per tenant). Freeze tenant writes for N minutes, dump from Airtable, load to Postgres, flip. Cheaper, riskier — silent drops during the freeze if anyone forgot to lock the Airtable UI. Not used because we cannot reliably lock Airtable from non-API edits (the CEO might still edit by hand).
3. **Big-bang all tenants** (rejected). Coupling all customers' downtime to one migration is the worst kind of risk concentration.

### B5. Reversibility *of the reversibility plan*

If the post-migration Postgres schema turns out wrong, do we have a path back to Airtable? Not really. Once we close out the dual-write window per tenant, Airtable is stale and the formula fields are dead. So the "reversible" framing in `README.md:85` ("Reversible by design") is a one-way reversibility: Airtable → Postgres is doable; Postgres → Airtable is not, in practice. Worth being honest about.

## Alternatives considered

### Alt 1 — Skip Airtable entirely, start on Postgres from day one

Rejected (already, per `CLAUDE.md` §Rejected). But worth re-stating the trade in the migration context:

- Pro: zero migration ever, no per-table 100K cap, no 5 req/sec ceiling, no webhook 7-day refresh cron.
- Con: lose Airtable's free schema editor for the CEO, the native Kanban view, the auto-generated forms, the formula language. Phase 1 (schema-in-Airtable-via-MCP) becomes Phase 1 (write SQL DDL + build admin UI). README estimates that costs ~2-3 weeks of head-start.

The trade still favors starting on Airtable for *this* customer, *this* timeline. But the migration cost we eventually pay (3-5 weeks) is bigger than the head-start (2-3 weeks). Net: we are paying ~1-2 weeks of premium for the optionality. Acceptable for customer #1, but document the math so future-us doesn't think we got the head-start "for free."

### Alt 2 — Migrate the storage layer but keep Airtable for the CEO's manual editing

Sync Postgres → Airtable one-way for the CEO's read/edit comfort, treat Postgres as system of record. Hybrid model. Possible with Airtable's own sync product, but: re-introduces the per-base 50K/125K limit on the mirror, complicates the "single source of truth" story. Not recommended.

### Alt 3 — Stay on Airtable forever, accept the walls

Possible if customer base stays small and per-tenant tables stay under 100K. Saves 3-5 weeks of future work. Risk: the first tenant who needs 100K+ rows in one table or sub-second write latency forces an emergency migration under pressure, which is exactly the "exponentially harder" failure mode Glide warns about. Not recommended past ~5 tenants.

## Proposed edits

### `README.md` — full prose

**`README.md:85`** (current):

```
Decision: **Airtable-as-backend for v1, migrate to Supabase Postgres at customer 10-20 (or first scaling pain).** Speed-to-first-customer wins over architectural purity. Reversible by design.
```

→ replace with:

```
Decision: **Airtable-as-backend for v1, migrate to Supabase Postgres when any tenant brushes a per-base or per-table wall, sustained rate-limit pressure shows up in Worker logs, or a customer needs Airtable-incompatible features (sub-second writes, formal SLA, on-prem).** Speed-to-first-customer wins over architectural purity. The migration is well-scoped (Worker abstracts the data layer) but is *not* a one-week job — realistic budget is 3-5 weeks for one engineer when the day comes, and the work scales per-tenant, not per-codebase. We start on Airtable knowing we will eventually pay that bill.
```

**`README.md:95-99`** (current "Why this hits fast + Project B + reversible" block, third bullet):

```
- **Reversible.** Worker abstracts Airtable. Migration day = swap one module. Frontend unchanged.
```

→ replace with:

```
- **Reversible at the interface, not free at the data layer.** The Worker abstracts Airtable so the *frontend* never has to change. The data move — schema port, formula re-implementation, attachment re-host, dual-write window, per-tenant cutover, validation — is its own ~3-5 week project the first time we do it (see `docs/decisions/08-migration-trigger.md`). We accept that cost as the price of the Phase 1 head-start.
```

(Also propose adding a one-line link to this decision doc from the README "Architecture" section so future readers can find the math.)

### `CLAUDE.md` — caveman

**`CLAUDE.md:20`** (current):

```
- **Migration plan.** Airtable → Postgres at customer 10-20 or first scaling pain. Worker abstracts Airtable so migration = swap one module.
```

→ replace with:

```
- **Migration plan.** Airtable → Postgres when tenant brushes per-base wall (50K Team / 125K Business), per-table 100K hard cap, sustained 429s, or first customer needing sub-second writes. NOT "customer 10-20" — count axis wrong. Worker abstracts interface so frontend stable; data move = 3-5 wk per first cutover, per-tenant rolling. See `docs/decisions/08-migration-trigger.md`.
```

**`CLAUDE.md:56`** (current):

```
- Don't propose migrating to Postgres yet. Decision is "later, when scaling pain hits."
```

→ replace with:

```
- Don't propose migrating to Postgres yet. Triggers in `docs/decisions/08-migration-trigger.md`. Fire on per-tenant table size / 429 rate / customer feature ask — not customer count.
```

### `HANDOFF.md` — caveman

**`HANDOFF.md:24`** (current):

```
5. **Backend:** Airtable now, Postgres at customer 10-20.
```

→ replace with:

```
5. **Backend:** Airtable now, Postgres when first tenant brushes a record/rate wall (see `docs/decisions/08-migration-trigger.md`). Not customer count.
```

### `TASKS.md` — caveman

No edit required to Phase 1 / 1.5 (schema in Airtable). Add at end of Phase 0 or as new monitoring task in Phase 1.5:

**`TASKS.md`** — append in Phase 1.5 after the auth-gate bullet:

```
- [ ] **Migration tripwire metrics.** Worker logs per-tenant: record count per base, max table size per base, 429 retry rate per base. Daily summary to console / dashboard. Trigger threshold: any tenant base ≥ 40K records, any table ≥ 80K rows, or 429 rate > N/day → manual review. See `docs/decisions/08-migration-trigger.md`.
```

## Open questions

1. **Is the per-table 100K cap firm on Enterprise Scale?** The community consensus says yes ([Whalesync][whalesync], [CriticNest][criticnest]), Airtable's official plans doc is silent. Worth a direct ask to Airtable sales the first time we actually need >100K rows in one table.
2. **Will the CEO want to keep editing in Airtable's UI post-migration?** If yes, we need to decide between (a) read-only Airtable mirror via sync, (b) build an admin UI in TanStack Start, or (c) just train her on the new admin UI. This is a product call, not a tech call, but it changes the migration scope by ±1 week.
3. **Where does the migration ETL live?** Local Bun script on the engineer's laptop (simple, one-off-flavored) vs a CF Queues handler (reusable, audit-trail). Recommend Queues handler — the second tenant migration is much cheaper if the first one left behind a runnable artifact.
4. **Encrypted attachments?** LOAs contain customer signatures. Today Airtable hosts them on its CDN with whatever ACLs Airtable provides. R2 lets us tighten this with signed URLs — good — but worth confirming the security posture aligns with what we promise customers.
5. **Do we need a "soft" intermediate step?** Some teams stage in DuckDB / SQLite before Postgres to prove the schema before paying for Supabase compute. Probably overkill at our size, but flag for future-us.

---

[airtable-pricing]: https://airtable.com/pricing
[plans]: https://support.airtable.com/docs/airtable-plans
[ratelimits]: https://airtable.com/developers/web/api/rate-limits
[whalesync]: https://www.whalesync.com/blog/airtable-record-limit
[criticnest]: https://criticnest.com/airtable-handle-50000-records/
[community-rate]: https://community.airtable.com/development-apis-11/api-rate-limit-46527
[switchlabs]: https://www.switchlabs.dev/resources/understanding-over-limits-in-airtable-navigating-record-and-field-constraints
[yaxify]: https://yaxify.medium.com/airtable-is-down-again-before-you-migrate-ask-this-one-question-102aa14dca72
[pg-generated]: https://www.postgresql.org/docs/current/ddl-generated-columns.html
[pg-notify]: https://www.postgresql.org/docs/current/sql-notify.html
[cf-supabase]: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/
[cf-limits]: https://developers.cloudflare.com/workers/platform/limits/
[cf-cpu-changelog]: https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/
[glide]: https://www.glideapps.com/blog/migrate-airtable-to-postgresql
[medium-pipeline]: https://medium.com/@tomhag_17/building-a-production-data-pipeline-my-debugging-journey-with-airtable-and-postgresql-20967791b740
[airtable-mysql]: https://www.linkedin.com/posts/sriramsubramanian2_airtable-migrating-a-multitenant-architecture-activity-7045074098678300672-zTUk
[audit-tool]: https://github.com/mperlak/airtable-migration-audit
[closefuture]: https://www.closefuture.io/blogs/airtable-to-supabase-migration-for-startups
[strangler]: https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig
[aws-strangler]: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html
