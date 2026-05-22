# Build tasks

Working backlog for the greenergiai CRM. Grouped by confidence and ordered roughly by build sequence. README has the "why"; this file has the "what to do."

Conventions:
- `[stated]` = she explicitly asked for it on the call.
- `[inferred]` = high-confidence inference from her business (TX energy brokerage) — bake into v1.
- `[open]` = needs her sign-off before we build. See "Open questions" at bottom.

---

## Phase 0 — Foundation

- [x] **Architecture decided.** Airtable backend + Cloudflare Worker + TanStack Start SPA. See README "Architecture." Atomic CRM, Twenty, NextCRM all rejected.
- [ ] **Stripe test-key replacement.** `VITE_PAYMENTS_CLIENT_TOKEN` = `pk_test_REPLACE_ME`. Pull live test key from Stripe dashboard (account `51TYVK6`, test mode).
- [ ] **Airtable service PAT.** Create scoped PAT in Airtable (`data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, `webhook:manage`). Store in Worker secrets (`wrangler secret put AIRTABLE_PAT`).
- [ ] **Tenant routing in Worker.** Read `Host` header → resolve tenant → return tenant's Airtable base ID + branding context. Hardcode map `greenenergiai.virecrm.com → base <id>` for now. Wildcard route already covered in `wrangler.jsonc`.
- [ ] **TanStack Start bootstrap.** Existing repo nuked. Rescaffold TanStack Start app, wire to Worker as backend, point Worker at Airtable. Bun-only.

## Phase 1 — Domain schema (in Airtable)

Map her master sheet to first-class tables, not a generic Contact/Custom-Field shape. Created via MCP `create_base` + `create_table` + `create_field`.

- [ ] **Create base `greenergiai`** in workspace `wspBUTSYGFioquhDD`.
- [ ] **Tables + fields (9-table v1, expanded per `docs/decisions/06-domain-schema.md`):**
  - `Customers` — Name, Primary Contact Name, Primary Title, Primary Phone, Primary Email, Notes, SIC Code, Business Type, Customer Category, Region, County, Credit Score, Annual Revenue, External Customer Id, linked → Service Addresses, linked → LOAs, linked → Deals.
  - `Service Addresses` — Street No, Street Name, Address 1, Address 2, City, State, ZIP, County, Govt Area, linked → Customer, linked → ESIs.
  - `ESIs` — ESI ID (string, 17–22 digit, Oncor prefix `1044372…`), Physical Meter Serial (distinct from ESI ID — xlsx `Meter Id`), EAC kWh (estimated), Billing AQ kWh (actual annual), Annual Usage kWh, linked → Service Address, linked → Current Contract.
  - `Contracts` — Supplier (REP single-select), Supply Type (`Electricity`/`Gas`), Start Date, End Date, Term Months (formula), Cost per kWh, Agent Mils (Unit Uplift), Currency (default USD), FX Rate (default 1.0), Pipeline Status (single-select: `pending`/`active`/`expired`/`lost`), Is Live (boolean), Sale Type (`Acquisition`/`Renewal`), Lost Date, Lost Reason (single-select), Lost Before Start (boolean), Lost After Live (boolean), Completed Post Live (boolean), Drop Date, Drop Reason, Nomination, Payment Term, Resold Status (single-select), Is Resold (boolean), Resold From Contract (self-link), Gross TCV (formula = Annual Usage × Term Years × Agent Mils ÷ 1000), Lost TCV, Net TCV (formula = Gross − Lost), AQ Loss, AQ Gain, Net AQ (formula), linked → ESI, linked → Deal.
  - `Deals` — Deal Name, External Sale Id, Sale Date, Stage (single-select: `Lead`/`Qualified`/`In Pricing`/`Sent`/`Won`/`Lost`), Sale Status (single-select: `Approved`/`Pending`/`Lost` — orthogonal to Stage), Objection Status, Objection Type (`PreLive`/`DuringLive`/`none`), Source of Lead (single-select), linked → Customer, linked → Primary Agent (Agents), linked → Secondary Agent (Agents), linked → Contract (set on Won).
  - `Agents` — Name, Email, House Split %, linked → Deals (as primary), linked → Deals (as secondary).
  - `LOAs` — PDF attachment, Signed Date, Expiration, linked → Customer.
  - `Commission Statements` — Supplier, Period, PDF attachment, Expected Amount (formula = Billing AQ × Mils ÷ 1000), Received Amount, Outstanding Amount, Net Outstanding Amount, Agent Comms Paid, Agent Comms Outstanding, Reconciliation Status (formula), linked → Contract (per-line-item).
  - `AggregatorPayouts` (NEW) — Aggregator Name, Aggregator Comm %, Period, linked → Contract. Empty table if broker is never sub-broker; future-proof.
- [ ] **Single-select option lists.** Suppliers (REPs) populated from curated TX-energy list. Deal stages locked. Lost Reason / Drop Reason / Source of Lead / Customer Category populated from xlsx distinct values during migration design.
- [ ] **Defer to Phase 4 if Phase 1 time-pressed:** `ContractEvents` (append-only audit log of `went_live` / `dropped` / `lost` / `renewed` transitions). v0 substitute = booleans on `Contracts` (Lost After Live, Completed Post Live).
- [ ] **Sanity-check schema** with Darsh before importing data.

## Phase 1.5 — Worker data layer

The Worker is the only Airtable client. Frontend talks to Worker, never to Airtable directly.

- [ ] **Airtable client module.** `src/server/airtable.ts` — typed wrapper over Airtable REST API. Batches reads (10/req), respects 5 req/sec, exposes domain-shaped functions (`getCustomer`, `listDealsForStage`, `closeDeal`).
- [ ] **Read cache.** Edge cache in Worker (KV or in-memory) for hot reads (customer detail, pipeline view). TTL 30-60s. Invalidate on writes.
- [ ] **Webhook refresh cron.** Airtable webhooks expire after 7 days inactivity. Cron worker hits `/webhooks/refresh` daily to re-poke.
- [ ] **Auth gate.** Supabase JWT verified in Worker. JWT claim → tenant. Tenant → Airtable base. No tenant in JWT = 403.

## Phase 2 — One-shot xlsx migration `[stated]`

One-time launch task — not a recurring user-facing import UI. Run once, she sees her data live.

- [ ] **Parse `Copy of NGP MASTER LIST - Copy.xlsx`** in a Bun script. 83 columns, 5445 data rows, single `Company = NGP-Americas` value (drop). Header `Customer Name` duplicated at col AJ — skip on import. Headers + first 20 rows inspected in `docs/decisions/06-domain-schema.md` §1.
- [ ] **Field mapping spec.** Source of truth lives at `docs/decisions/06-domain-schema.md` §1 (75/83 cols map cleanly, 1 dropped constant, 1 dropped duplicate, 6 deferred COVID/historical metrics). Migration script implements that mapping verbatim.
- [ ] **Normalize on import.** xlsx `Meter Number` → `ESIs.ESI ID`. xlsx `Meter Id` → `ESIs.Physical Meter Serial` (distinct field). Dates → ISO. Mils stored as numeric (not pre-divided by 1000). `Pri Agent` + `Sec Agent` → two separate links on Deal.
- [ ] **Migration script.** Idempotent. Reads xlsx, normalizes (ESI string, dates ISO, dollar amounts), writes via Airtable API in batches of 10 (respects 5 req/sec). Logs row-by-row "what failed and why."
- [ ] **Spot-check 5 customer records in UI** before declaring import done.
- [ ] **Backfill two years of historical clients** via same script.

## Phase 3 — Pipeline + tabs `[stated]`

- [ ] **Pipeline UI.** Kanban via Atomic CRM's existing board. Stages: `Lead → Qualified → In Pricing → Sent → Won → Lost`. Drag-and-drop between stages.
- [ ] **"In Pricing" tab.** Filtered view of deals in `In Pricing` stage. Surfaces the deal currently being quoted to the customer.
- [ ] **"Current Clients" tab.** Filtered view of customers with at least one `active` contract. Per-customer detail shows all ESIs, contract terms, dates, rates.
- [ ] **Close-deal flow.** When deal → `Won`: prompt for agent mils, compute TCV, attach contract to ESI(s), graduate customer into Current Clients automatically. No double entry.

## Phase 4 — Domain-fit features `[inferred]`

Things she didn't ask for but the TX energy-brokerage workflow makes table-stakes. Build into v1; surface to her early so she validates.

- [ ] **Renewal radar.** Dashboard widget: meters expiring in next 30 / 90 / 180 / 365 days. Daily cron writes upcoming renewals to a calendar feed Outlook can sync. Likely her #2 unstated pain.
- [ ] **ESI-first global search.** Top-bar search box takes ESI number (`1044XXX`), customer name, agent name, or address → opens correct record. One box, no submenu hunt.
- [ ] **Per-customer detail page.** Shows all ESIs in a single table with status (`active` / `expiring soon` / `expired` / `dropped`). Multi-meter / chain accounts must work.
- [ ] **Supplier comparison view (In Pricing).** Pricing matrix UI: REP × term-length → ¢/kWh. Agent picks winning quote → seeds the Won deal.
- [ ] **LOA gate.** Block "In Pricing" stage transition unless customer has a non-expired LOA on file. Reduces "wait, did we get her sig?" rework. Per-customer LOA upload (PDF), signed-on date, expiration tracked.
- [ ] **Commission reconciliation.** Upload monthly supplier statement → reconcile against expected (active contracts × kWh × mils). Surface gaps as "supplier X owes you Y for meter Z."
- [ ] **Agent leaderboard.** Dashboard: closed TCV YTD, deals in pipeline by stage, mils sold per agent. She runs the business — wants the producer view.
- [ ] **Mobile read view.** Atomic CRM is responsive-ish; verify deals + customers readable on phone. Full editing desktop-only is fine for v1.

## Phase 5 — Outlook integration `[stated]`

- [ ] **Microsoft Graph OAuth.** Per-agent connect flow. Office 365 + Exchange Online supported (no on-prem). Tokens stored encrypted in Supabase.
- [ ] **Two-way email sync default on.** No "Labs toggle" — connection = sync.
- [ ] **Email threads attach to deal/customer.** Inbound emails from a customer contact auto-link to their record.
- [ ] **Outbound send-from-CRM.** Compose email inside deal view, sends via Graph as the agent's mailbox.
- [ ] **Calendar push.** Contract end dates + renewal nudges flow to agent's Outlook calendar.
- [ ] **Token refresh + UX.** Silent refresh; surface clear "reconnect Outlook" prompt if it dies.

## Phase 6 — Polish

- [ ] **Onboarding flow.** First-deal-imported under 10 minutes for a non-technical user (no tutorial required).
- [ ] **Sane defaults.** Ships with stages pre-set, no setup wizard.
- [ ] **Production deploy.** `greenenergiai.virecrm.com` live, SSL via Cloudflare for SaaS, smoke test all flows.
- [ ] **Handoff doc for her.** One-pager: how to add a deal, how to close a deal, how to find a meter, who to email if it breaks.

---

## Open questions for the next call with her

1. **Renewal workflow today.** How does she find renewals now — spreadsheet sort, calendar reminders, Outlook flags? Knowing the current method tells us what UX to beat.
2. **Commission statements.** Where do supplier commission statements land today — email PDFs, supplier portal, paper? Manual reconcile or trust the check?
3. **LOA process.** Paper signature, DocuSign, emailed PDFs? If DocuSign, integrate; otherwise just upload + track.
4. **Customer-facing portal.** Needed at launch (`customers.virecrm.com`), or v2? The route already exists in `wrangler.jsonc` so prior intent suggests yes-eventually.
5. **Pricing quote source.** Does she maintain a rate matrix herself, pull rates per-deal from REPs by phone/email, or use a third-party broker portal (e.g. EnergyAuctions, NRG broker portals)? Determines whether In Pricing is a comparison UI or just a "log the quote" form.
6. **Usage data ingest.** Customers send 12-mo bill PDFs? Currently key-entered? OCR worth building?
7. **Agent commission splits.** Does the house take a cut of agent mils? Need split formula if so.
8. **E-sign on contracts.** Outbound contract delivery — DocuSign, paper, or both?
9. **Supplier list.** Fixed dropdown of REPs she works with, or open-ended? Affects schema (FK vs string).
10. **Drop tracking.** Does she need to track "supplier dropped this meter"? Common in TX energy; relevant for the Current Clients health view.
