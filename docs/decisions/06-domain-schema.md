# 06 — Domain schema fit vs xlsx

> **⚠ Agent-authored.** Drafted by AI agents from xlsx-inspection output + research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

## Verdict

**Modify, don't replace.** The 8-table model in `TASKS.md` Phase 1 captures the right entities (Customer / Service Address / ESI / Contract / Deal / Agent / LOA / Commission Statement) and is structurally correct. But it is **under-specified** against the actual data she's bringing in: the xlsx has 84 columns × 4,792 data rows (per 2026-05-23 `scripts/inspect-xlsx.ts` run), ~14 of which carry signal the current schema would silently drop. The single biggest sins are (a) one-agent-per-deal where xlsx clearly records two, (b) one-status-field where xlsx tracks four orthogonal lifecycle dimensions, (c) no aggregator/sub-broker chain, and (d) no usage-vs-billed reconciliation fields that drive commission disputes in TX energy.

Fix list is targeted: expand `Deals` (dual agent + lost reason/date), expand `Contracts` (billing vs estimated AQ, contract state machine), add an `AggregatorPayouts` table or fields to `CommissionStatements`, and add a small `ContractEvents` audit table for lifecycle. LOA and Commission Statement stay as their own tables (commissions especially — too much accounting weight to inline).

Cost of getting this wrong: GHL-grade silent column drops on the one-shot migration, which is the exact failure mode the project's first product principle is built against (`README.md` line 13).

## Decision

Promote the schema to a **9-table model** with the following deltas vs the existing `TASKS.md` Phase 1:

1. **`Customers`** — add `SIC Code`, `Business Type`, `Customer Category`, `Region`, `County`, `Credit Score`, `Company TurnOver` (annual revenue). Move physical address fields out of here and onto `Service Addresses`.
2. **`Service Addresses`** — add `Street No`, `Street Name`, `Address 1`, `Address 2` (cover xlsx's split address fields), keep aggregated `Street/City/State/ZIP`.
3. **`ESIs`** — rename canonical field to `ESI ID` (industry-canonical, per ERCOT — see Evidence §2) with `Meter Number` as a display alias. Add separate `Physical Meter Serial` field for the device number (xlsx col `Meter Id`, distinct from ESI). Add `EAC kWh` (estimated annual consumption) **and** `Billing AQ kWh` (actual billed annual) as separate fields — they diverge in practice and divergence is what drives commission disputes.
4. **`Contracts`** — restructure status from one field into four:
   - `Pipeline Status` (single-select: `pending` / `active` / `expired` / `lost`)
   - `Is Live` (checkbox/boolean — derived: did contract reach start date and begin billing)
   - `Lost Date` + `Lost Reason` (single-select) + `Lost Before Start Date` (checkbox) — populated only when `Pipeline Status = lost`
   - `Drop Date` + `Drop Reason` — populated when supplier kicked customer off mid-contract
   
   Add: `Sale Type` (single-select: `Acquisition` / `Renewal` — xlsx `Acq/Ren`), `Supply Type` (electricity vs gas — future-proof), `Currency` (default USD, support FX for any non-USD broker partner), `FX Rate`, `Nomination`, `Payment Term`, `Source of Lead`, `Resold Status` + `Resold Sale Id` (link to original contract record), `Gross TCV` + `Net TCV` + `Lost TCV` (formulas; net = gross − lost).
5. **`Deals`** — replace `Owner (Agent)` single link with **`Primary Agent`** + **`Secondary Agent`** (both linked to Agents). Add `Sale Date`, `Sale Status` (single-select: `Approved` / `Pending` / `Lost`, distinct from pipeline stage), `Objection Status` + `Objection Type` (`PreLive` / `DuringLive` / `none`).
6. **`Agents`** — keep as-is. House Split % already there.
7. **`LOAs`** — keep as separate table. PDF + dates + customer link is small but the lifecycle (signed → expiration → re-sign) is its own concern and "block In Pricing without valid LOA" is a real workflow (TASKS.md Phase 4).
8. **`Commission Statements`** — expand significantly:
   - Per-contract rows (link to specific Contract, not just to Statement)
   - `Expected Amount` (formula: billed kWh × mils ÷ 1000)
   - `Received Amount` + `Outstanding Amount` + `Net Outstanding Amount` (xlsx triple)
   - `Comms Paid` + `Comms Outstanding` (xlsx pair — commissions broker has paid agents vs still owes)
   - `Reconciliation Status` (formula: `expected vs received`)
9. **NEW — `AggregatorPayouts`** — when the broker themselves is a sub-broker under a larger aggregator (`Agg Name` + `Agg Comm %` in xlsx), this table tracks the upstream commission chain. Fields: `Aggregator Name`, `Aggregator Comm %`, linked → Contract. If the CEO is *never* a sub-broker, this table is empty and zero-cost. Schema future-proofs.
10. **NEW (optional) — `ContractEvents`** — append-only audit log of contract state transitions (`went_live`, `dropped`, `lost`, `renewed`). Powers the historical-rollup dashboard and lets us answer "Lost After Went Live?" / "Completed After Live?" without those being denormalized booleans on `Contracts`. Defer to Phase 4 if Phase 1 is time-pressed; the booleans on `Contracts` are an acceptable v0.

## Evidence

### §1 — All 84 xlsx columns mapped

Column letter, header, target table.field. Rows derived from `Copy of NGP MASTER LIST - Copy.xlsx`. Canonical counts (2026-05-23 `scripts/inspect-xlsx.ts` via ExcelJS `actualRowCount` / `actualColumnCount`): **4,792 data rows × 84 columns**. Column `CF` exists but is fully empty across all rows. Single `Company = NGP-Americas` value across all populated rows. Re-run the inspect script whenever the source xlsx is replaced and update this section.

| # | Col | xlsx header | Target | Notes |
|---|---|---|---|---|
| 1 | A | Company | **NOT MAPPED — drop** | Single value `NGP-Americas` across all rows. Pre-migration sanity, not multi-tenant data. Tenant comes from subdomain. |
| 2 | B | Sale Id | `Deals.External Sale Id` | Preserve for traceability + idempotent re-runs. |
| 3 | C | Sale Date | `Deals.Sale Date` | |
| 4 | D | Customer Name | `Customers.Name` | |
| 5 | E | Meter Number | `ESIs.ESI ID` | Industry-canonical = ESI ID, per Evidence §2. xlsx "Meter Number" is colloquial. |
| 6 | F | Supply Type | `Contracts.Supply Type` | Single-select. v1 source values observed: `Non-HH`, `Gas` (no `Electricity` rows present). `Non-HH` = UK "Non Half-Hourly" small-commercial electricity meter classification (xlsx UK origin per §3) — preserve verbatim; do not coerce to `Electricity` without explicit decision. Migration must quarantine the 7 polluted free-text entries the 2026-05-23 inspect run found in this column (e.g. `Emailed Erica- 10.31.2023`). |
| 7 | G | Unit Uplift | `Contracts.Agent Mils` | "Unit uplift" = uplift per unit (kWh) = mils. Already in schema. |
| 8 | H | EAC AQ | `ESIs.EAC kWh` | Estimated Annual Consumption (UK term, kept for migration). |
| 9 | I | Meter Consumption | `ESIs.Annual Usage kWh` | Already in schema (Annual Usage). Reconcile with EAC. **v1 source: literal `-` in every row** (data likely stripped pre-export, not absent from the business). Migration coerces `-` → NULL; client populates via UI or supplier ingest post-launch. CRM operates with or without. |
| 10 | J | Start Date | `Contracts.Start Date` | |
| 11 | K | End Date | `Contracts.End Date` | |
| 12 | L | Currency | `Contracts.Currency` | Default USD. Field exists for portability. |
| 13 | M | Gross TCV | `Contracts.Gross TCV` | Formula in v1 (Annual Usage × Term × Mils ÷ 1000). Store xlsx value for cross-check during migration. |
| 14 | N | Lost TCV | `Contracts.Lost TCV` | TCV component lost to early termination / partial drop. **v1 source: `0` in every row** (data likely scrubbed pre-export). Schema preserved; client populates via UI. CRM operates with or without. |
| 15 | O | Lost Part Contract | `Contracts.Lost Partial` | Boolean — partial-period loss. |
| 16 | P | Net TCV | `Contracts.Net TCV` | Formula: Gross − Lost. |
| 17 | Q | Is Contract Live? | `Contracts.Is Live` | Boolean. Derived in v1 (start_date ≤ today ≤ end_date AND status = active), but store on migration. |
| 18 | R | Sale Status | `Deals.Sale Status` | Single-select. v1 source values observed: `Approved` / `Lost` / `Completed` / `Meter Check` / `Declined` / `Objection`. Originally spec'd as 3 values (Approved/Pending/Lost); expanded to all 6 to preserve round-trip fidelity. Distinct from pipeline Stage. |
| 19 | S | Obj Status | `Deals.Objection Status` | Customer objection lifecycle. |
| 20 | T | Supplier | `Contracts.Supplier` | Single-select REP list. Already in schema. |
| 21 | U | Lost Date | `Contracts.Lost Date` | |
| 22 | V | Lost Reason | `Contracts.Lost Reason` | Single-select. |
| 23 | W | Is Lost before start date? | `Contracts.Lost Before Start` | Boolean. Determines whether contract ever went live. |
| 24 | X | Is it future start date | **derived, drop column** | Computable: `start_date > today`. No need to store. |
| 25 | Y | AQ Loss | `Contracts.AQ Loss` | Annual quantity lost — drives commission impact. **v1 source: `0` in every row** (likely scrubbed pre-export). Client populates via UI or supplier ingest. |
| 26 | Z | AQ Gain | `Contracts.AQ Gain` | **v1 source: `0` in every row** (likely scrubbed pre-export). Client populates via UI or supplier ingest. |
| 27 | AA | Net AQ Loss/Gain | `Contracts.Net AQ` | Formula: Gain − Loss. **v1 source: `0` in every row** (likely scrubbed pre-export). Auto-computes once Loss/Gain populated. |
| 28 | AB | Normal AQ Loss | **NOT MAPPED — defer** | COVID-era reporting split. Historical only. If she ever needs it, add Phase 4. |
| 29 | AC | Normal AQ Gain | **NOT MAPPED — defer** | Same. |
| 30 | AD | Normal Net AQ Loss/Gain | **NOT MAPPED — defer** | Same. |
| 31 | AE | Covid AQ Loss | **NOT MAPPED — defer** | Same — pandemic carve-out. |
| 32 | AF | Covid AQ Gain | **NOT MAPPED — defer** | Same. |
| 33 | AG | Net Covid AQ | **NOT MAPPED — defer** | Same. |
| 34 | AH | Contract Ended? | `Contracts.Pipeline Status = expired` | Derived. Don't store separately. |
| 35 | AI | PreLive or During Live Objection? | `Deals.Objection Type` | Single-select: `PreLive` / `DuringLive` / `none`. |
| 36 | AJ | Customer Name (duplicate of D) | **drop in migration** | Duplicate column at AJ — same string-table idx (3) as D. Migration script must skip. |
| 37 | AK | Company TurnOver | `Customers.Annual Revenue` | Used for risk/credit qualification. |
| 38 | AL | Credit Score | `Customers.Credit Score` | |
| 39 | AM | Is Gone Live? | `Contracts.Is Live` | Same field as Q (Is Contract Live?). Coalesce on import. |
| 40 | AN | Lost After Went Live? | `ContractEvents` (or `Contracts.Lost After Live` boolean v0) | Powered by event audit log in v1+; boolean acceptable for migration. |
| 41 | AO | Completed After Live? | `Contracts.Completed Post Live` | Boolean. |
| 42 | AP | Went Live Still Inprogress? | derived (`Is Live AND not expired AND not lost`) | Don't store. |
| 43 | AQ | Pri Agent | `Deals.Primary Agent` (linked → Agents) | **Schema currently has only Owner (single agent). Must split.** |
| 44 | AR | Sec Agent | `Deals.Secondary Agent` (linked → Agents) | **New field.** |
| 45 | AS | Sale Type | `Contracts.Sale Type` | Single-select: `Acquisition` / `Renewal`. Distinct from xlsx Acq/Ren (BO) — sometimes redundant. Migration must reconcile. |
| 46 | AT | AQ Check | `Contracts.AQ Check` | Numeric — reconciliation flag. Store raw. **v1 source: `-` in every row** (likely stripped pre-export). Coerce `-` → NULL; client populates via UI or supplier ingest. |
| 47 | AU | Billing AQ | `ESIs.Billing AQ kWh` | Annual quantity per supplier billing. The number that drives commission paid (not EAC). **v1 source: `-` in every row** (likely stripped pre-export — broker may track this in a separate system, supplier portal, or accountant's books). Coerce `-` → NULL; client populates via UI, manual entry, or supplier-statement ingest. Reconciliation logic in §6 ships and operates against whichever rows have data; rows without Billing AQ skip the reconciliation step. |
| 48 | AV | Resold Status | `Contracts.Resold Status` | Single-select. v1 source values: `-`, `Same Month`, `Future Month`. Migration coerces `-` → NULL; enum = `same_month` / `future_month`. |
| 49 | AW | Nomination | `Contracts.Nomination` | Single-select. (UK-style nomination — kept for data fidelity.) |
| 50 | AX | Customer Category | `Customers.Category` | Single-select. |
| 51 | AY | Sic Code | `Customers.SIC Code` | Standard Industrial Classification. String. |
| 52 | AZ | Business Type | `Customers.Business Type` | Single-select. |
| 53 | BA | Payment Term | `Contracts.Payment Term` | Single-select (e.g. `Net 30`). |
| 54 | BB | Received Amount | `CommissionStatements.Received Amount` | Per-contract row. |
| 55 | BC | Outstanding Amount | `CommissionStatements.Outstanding Amount` | |
| 56 | BD | Net Outstanding Amount | `CommissionStatements.Net Outstanding` | |
| 57 | BE | Comms Paid | `CommissionStatements.Agent Comms Paid` | Commissions broker has paid out to agents. **v1 source: `-` in every row** (likely stripped pre-export). Coerce `-` → NULL; client populates via UI. |
| 58 | BF | Comms Outstanding | `CommissionStatements.Agent Comms Outstanding` | Commissions owed to agents but not yet paid. **v1 source: `-` in every row** (likely stripped pre-export). Coerce `-` → NULL; client populates via UI. |
| 59 | BG | Customer Id | `Customers.External Customer Id` | Preserve original ID. |
| 60 | BH | Meter Id | `ESIs.Physical Meter Serial` | **Distinct from ESI ID.** Physical device serial, changes on swap. |
| 61 | BI | Agg Name | `AggregatorPayouts.Aggregator Name` (NEW table) | Aggregator / upstream broker name. |
| 62 | BJ | Agg Comm % | `AggregatorPayouts.Aggregator Comm %` | Percentage upstream takes. |
| 63 | BK | Source of Lead | `Deals.Source of Lead` | Single-select. **v1 source: 1 distinct value (`Be-Spoke`).** Preserve column; no UI filter wired in v1. Populate enum from source distincts in future migrations. |
| 64 | BL | FX Rate | `Contracts.FX Rate` | Default 1.0 USD. |
| 65 | BM | Acq/Ren | `Contracts.Sale Type` | Same as AS. Coalesce. |
| 66 | BN | Contract Length | derived from Start/End | Term Months already formula. Don't store separately unless xlsx values disagree with `End − Start`. |
| 67 | BO | Customer Region | `Customers.Region` | (Customer-level rollup, e.g. "TX-Oncor", "TX-Centerpoint".) |
| 68 | BP | Zip Code | `Service Addresses.ZIP` | Already in schema. |
| 69 | BQ | County | `Service Addresses.County` | New field — TX uses counties for some TDU service-area logic. |
| 70 | BR | Govt. Area | `Service Addresses.Govt Area` | Free-form. Default empty in TX (UK leftover). |
| 71 | BS | Is Resold | `Contracts.Is Resold` | Boolean. |
| 72 | BT | Resold Sale Id | `Contracts.Resold From Contract` (linked → Contracts) | Self-link to original contract record. |
| 73 | BU | contact_person | `Customers.Primary Contact Name` | (Schema currently has `Customers.Name` for business name; this is the human contact.) |
| 74 | BV | designation | `Customers.Primary Title` | Already in schema. |
| 75 | BW | customer_email | `Customers.Primary Email` | |
| 76 | BX | telephone | `Customers.Primary Phone` | |
| 77 | BY | address_1 | `Service Addresses.Address 1` | |
| 78 | BZ | address_2 | `Service Addresses.Address 2` | |
| 79 | CA | street_name | `Service Addresses.Street Name` | |
| 80 | CB | street_no | `Service Addresses.Street No` | |
| 81 | CC | city | `Service Addresses.City` | **v1 source: city/state swapped in many rows** (e.g. `city = MA`, `state = Canton`). Migration must detect 2-letter US state code in `city` and swap with `state`. Spot-check after import. |
| 82 | CD | state | `Service Addresses.State` | See CC — paired swap coercion. |
| 83 | CE | postcode | `Service Addresses.ZIP` | Coalesce with Zip Code (BP). Migration must reconcile. |
| 84 | CF | (empty) | **NOT MAPPED — drop** | Column exists in worksheet but is fully empty across all 4792 rows. Discovered on 2026-05-23 inspect re-run. Drop alongside `A` (constant) and `AJ` (dup). |

**Summary:** Source has **84 columns × 4792 data rows** (per 2026-05-23 inspect). **75/84 round-trip.** 3 dropped (constant `Company` A, duplicate `Customer Name` AJ, empty `CF`). 6 deferred (COVID + Normal AQ historical metrics). All 8 critical missing-from-schema fields (dual agent, lost reason/date, aggregator, billing vs estimated AQ, currency/FX, sale status, objection type, physical meter serial) are added via the Decision section. Several v1-blank/zero fields (Lost TCV, AQ Loss/Gain, AQ Check, Billing AQ, Comms Paid, Comms Outstanding, Meter Consumption) retain schema columns but carry no signal in this dataset — see per-row notes above and §6.

### §2 — ESI ID vs Meter Number — canonical term

ERCOT (Electric Reliability Council of Texas) defines **ESI ID** (also written ESI-ID, ESID, or ESIID) as the unique 17–22-digit identifier assigned to every electricity meter location in the deregulated Texas market. It is tied to the **service address**, not the physical meter device — it persists through meter swaps. ([electricityplans.com — ESID Lookup](https://electricityplans.com/texas/esid-lookup/), [aect.net — ESID](https://www.aect.net/electric-service-identifier-esid)).

The **meter number** is a physically printed serial on the device and changes on meter replacement ([myenergenie.com — ESID vs Meter Number](https://www.myenergenie.com/esid-vs-electric-meter-key-differences-explained/)).

Oncor TDU prefix: 17-digit ESI IDs starting `1044372` (or `1017699` for East TX) followed by a 10-digit premise code ([powerwizard.com — ESID Lookup](https://www.powerwizard.com/tools/esid-lookup/), [shoptexaselectricity.com — ESI ID Lookup](https://www.shoptexaselectricity.com/learn/texas-esiid-lookup/)). This matches the README's "prefixed `1044…` (Oncor territory)" — those values in the xlsx are ESI IDs, mislabeled as "Meter Number".

**Conclusion:** Use `ESI ID` as the canonical field name (with `ESID` as display alias accepted in import). Reserve `Physical Meter Serial` for xlsx column `Meter Id` (BH).

### §3 — UK-origin xlsx schema, repurposed for TX

The xlsx schema clearly originated from a UK energy-broker system: "EAC" (Estimated Annual Consumption, UK term — [ugp.co.uk EAC](https://www.ugp.co.uk/support/faqs/billing/#faq-what-is-an-eac), [utilityfair.ie](https://www.utilityfair.ie/business-energy-insights/gas-tariffs-spc-and-eac)), "AQ" (Annual Quantity — gas term in UK), "Non-HH" (Non Half-Hourly metering classification — UK small-commercial electricity), "Govt. Area", "Nomination", "Currency" + "FX Rate" (multi-currency support), "Sic Code" (UK Companies House style). The data inside has been ported to TX usage (USD currency, ESI IDs in "Meter Number" col, "Region = TX"). The schema must not assume xlsx vocabulary is industry-standard for TX — translate **at the storage layer** only where TX has a different canonical term (Meter Number → ESI ID being the biggest one).

**UI layer: display verbatim, tooltip explains.** Stored values render to the broker dashboard exactly as the xlsx encoded them — `Non-HH`, `Nomination`, `Govt Area`, `EAC`, `AQ`, `SIC Code` etc. all surface in the UI as-is. Each such label carries a hover tooltip with the definition (UK origin, TX equivalent if any, source-of-truth pointer). This preserves the round-trip principle through to the render layer and removes the agent-onboarding friction that display-coercion would introduce in DB exports / supplier invoices / CSV downloads. Convention is documented in `CLAUDE.md` § UI. Canonical glossary lives in `CLAUDE.md` § Domain glossary.

### §4 — Dual-agent reality

The xlsx contains `Pri Agent` (AQ) and `Sec Agent` (AR) on every deal row. The current schema has `Deals.Owner (Agent)` — single link. Search results on energy-broker commission structures consistently show **2–3 people paid on a single deal** (sales agent + sales manager override + sometimes a referral / channel partner) — [Diversegy — Commission Splits](https://diversegy.com/energy-brokers/energy-broker-fees/), [Edge On Demand — Broker Commissions](https://www.edgeondemand.com/energy-broker-commissions). Either:

- (a) **Add `Primary Agent` + `Secondary Agent` direct links on `Deals`** — simplest, matches xlsx exactly. House Split % on Agents covers the % math. *Recommend this.*
- (b) Join table `DealAgents` (Deal, Agent, Role, Split %). More flexible if 3+ agents ever common. **Overkill for v1** unless she confirms it.

Default to (a). Re-evaluate if she ever says "3 agents on one deal."

### §5 — Contract state machine — 4 dimensions, not 1

The xlsx tracks **four orthogonal lifecycle dimensions** that the current schema folds into one `Status` field:

1. **Pipeline progress** — `pending` / `active` / `expired` / `lost` (current schema)
2. **Live status** — `Is Contract Live?` (Q), `Is Gone Live?` (AM) — whether contract reached start date and began billing. Distinct from "active" — a contract can be `active` (signed, future start) but not yet live.
3. **Loss path** — `Lost Date` (U), `Lost Reason` (V), `Lost Before Start Date` (W), `Lost After Went Live` (AN)
4. **Drop path** — TX `drop` terminology — distinct from "lost" because a drop is the supplier kicking customer off, not the customer leaving ([Diversegy — Early Termination](https://diversegy.com/energy-brokers/early-termination-fees/), [Electric Choice — Break Contract](https://www.electricchoice.com/blog/break-contract-provider/)). Drop tracking listed as Phase 4 in TASKS.md.

**Decision:** Keep one `Pipeline Status` enum + separate `Is Live` boolean + lost-dimension fields + drop-dimension fields. The `ContractEvents` audit table cleanly captures the transitions. Booleans on `Contracts` are an acceptable v0.

### §6 — Commission accounting depth

The xlsx has **seven fields** carrying commission-accounting state:
- `Received Amount` (BB), `Outstanding Amount` (BC), `Net Outstanding Amount` (BD) — supplier → broker
- `Comms Paid` (BE), `Comms Outstanding` (BF) — broker → agent
- `Agg Name` (BI), `Agg Comm %` (BJ) — broker → upstream aggregator (when broker is a sub-broker)

Plus `Billing AQ` (AU) — the actual billed volume that drives `expected = billed × mils ÷ 1000`. Per [Diversegy on commissions](https://diversegy.com/energy-brokers/energy-broker-fees/) and [Methodia — Commission Management](https://www.methodia.com/blog/commission-management-for-energy-brokers-and-suppliers): commissions are paid monthly per actual billed kWh, not per the EAC estimate at signing. The variance between EAC and actual billing is a common source of disputes — the schema must have capacity to track it.

**Decision:** Expand `CommissionStatements` to per-contract line items, add expected-vs-received reconciliation formula, add new `AggregatorPayouts` table (or nullable fields on `Contracts`) for the upstream chain.

**v1 source data state (2026-05-23 inspect).** The Billing AQ, AQ Check, Comms Paid, Comms Outstanding, and Meter Consumption columns are literal `-` in every row of the source xlsx. Confirmed with the client (2026-05-23): data was likely stripped pre-export rather than absent from the business. Schema columns ship as designed; reconciliation logic operates per-row against whatever data is present. The CRM must work both with and without these fields populated — rows lacking Billing AQ skip the expected-vs-received computation and surface "awaiting data" in the UI rather than blocking. The client populates via three paths: (a) UI form entry, (b) bulk re-import with corrected xlsx, (c) supplier-statement ingest (Phase 4).

### §7 — LOA stays its own table

LOA = single PDF + 2 dates + 1 link = 4 fields. Could be inlined as `Customers.LOA Attachment` + `LOA Signed Date` + `LOA Expiration`. **Counter-argument (keep table):** LOAs expire and need re-signing; a customer accumulates LOAs over time (current + historical). One-to-many. Also the workflow "block In Pricing stage transition unless customer has a non-expired LOA on file" (TASKS.md Phase 4) is cleaner with its own table — query "give me the latest unexpired LOA for customer X" is a sort+filter on the table. Inlining means storing only the latest, losing audit. **Keep LOAs as own table.**

### §8 — Airtable plan + capacity check

- **Field cap:** 500 per table ([Airtable Plans](https://support.airtable.com/docs/airtable-plans)). Largest table after expansion is `Contracts` at ~30 fields. **No risk.**
- **Record cap:** Team plan = 50,000/base. Estimated total records after migration: ~5,445 deals × (1 contract + 1 ESI + 1 service address) + ~3,000 customers + ~10 agents + LOAs + commission statements ≈ 18–22K records. **Comfortable headroom on Team.**
- **Linked record cap:** No hard cap per cell (community evidence: some users at thousands of links without major lag; [Airtable Linked Records](https://support.airtable.com/docs/linked-record-field)). Customer → multiple ESIs / contracts won't strain.

Schema fits. Migration plan unchanged at architectural level — Airtable can hold this.

## Alternatives considered

1. **Keep the 8-table schema as-is.** Migration script forced to drop ~14 columns of signal. Violates the README product principle 1 ("Every column on her master sheet must round-trip with zero pre-config" — `README.md` line 13). **Rejected.**

2. **Generalize via Contact + Custom Fields (Atomic CRM style).** This is exactly the GHL anti-pattern the project is built against. **Rejected.**

3. **Full 14-table schema** — split `ContractEvents` audit into Phase 1, separate `Suppliers` table, separate `BillingPeriods` table, etc. Schema accuracy beats Phase 1 throughput by too much margin. **Defer to Phase 4** — `ContractEvents` is the only "promote to Phase 1" candidate, and even that's optional if booleans suffice on first import.

4. **Inline LOAs as fields on Customer.** Loses history. Workflow "block on expired LOA" requires latest-unexpired query. Marginal savings, real workflow cost. **Rejected** (§7).

5. **Use `Meter Number` as canonical instead of `ESI ID`.** xlsx label, locally familiar. But every external system (REPs, TDUs, ERCOT lookups) uses ESI ID. Importing under one name, exporting under another, having to translate — wrong trade. **Rejected.** Use ESI ID; treat "Meter Number" as a display alias the migration script normalizes on input.

## Proposed edits

### `TASKS.md` Phase 1 — REWRITE

Replace the `Tables + fields` block with:

```markdown
- [ ] **Tables + fields (v1):**
  - `Customers` — Name, Primary Contact Name, Primary Title, Primary Phone, Primary Email, Notes, SIC Code, Business Type, Customer Category, Region, County, Credit Score, Annual Revenue, External Customer Id, linked → Service Addresses, linked → LOAs, linked → Deals.
  - `Service Addresses` — Street No, Street Name, Address 1, Address 2, City, State, ZIP, County, Govt Area, linked → Customer, linked → ESIs.
  - `ESIs` — ESI ID (string, 17-22 digits, prefix `1044…` for Oncor), Physical Meter Serial (xlsx Meter Id), EAC kWh (estimated), Billing AQ kWh (actual annual), Annual Usage kWh, linked → Service Address, linked → Current Contract.
  - `Contracts` — Supplier (REP single-select), Supply Type (`Electricity`/`Gas`), Start Date, End Date, Term Months (formula), Cost per kWh, Agent Mils (Unit Uplift), Currency (default USD), FX Rate (default 1.0), Pipeline Status (single-select: `pending`/`active`/`expired`/`lost`), Is Live (boolean), Sale Type (`Acquisition`/`Renewal`), Lost Date, Lost Reason (single-select), Lost Before Start (boolean), Lost After Live (boolean), Completed Post Live (boolean), Drop Date, Drop Reason, Nomination, Payment Term, Resold Status (single-select), Is Resold (boolean), Resold From Contract (self-link), Gross TCV (formula), Lost TCV, Net TCV (formula = Gross − Lost), AQ Loss, AQ Gain, Net AQ (formula), linked → ESI, linked → Deal.
  - `Deals` — Deal Name, External Sale Id, Sale Date, Stage (single-select: `Lead`/`Qualified`/`In Pricing`/`Sent`/`Won`/`Lost`), Sale Status (single-select: `Approved`/`Pending`/`Lost`), Objection Status, Objection Type (`PreLive`/`DuringLive`/`none`), Source of Lead (single-select), linked → Customer, linked → Primary Agent (Agents), linked → Secondary Agent (Agents), linked → Contract (set on Won).
  - `Agents` — Name, Email, House Split %, linked → Deals (as primary), linked → Deals (as secondary).
  - `LOAs` — PDF attachment, Signed Date, Expiration, linked → Customer.
  - `Commission Statements` — Supplier, Period, PDF attachment, Expected Amount (formula = Billing AQ × Mils ÷ 1000), Received Amount, Outstanding Amount, Net Outstanding Amount, Agent Comms Paid, Agent Comms Outstanding, Reconciliation Status (formula), linked → Contract (per-line-item), linked → Statement Batch.
  - `AggregatorPayouts` — Aggregator Name, Aggregator Comm %, Period, linked → Contract. (Empty table if broker is never sub-broker; future-proof.)
- [ ] **Defer to Phase 4 if time-pressed:** `ContractEvents` (append-only audit log: `went_live`/`dropped`/`lost`/`renewed` transitions). v0 substitute = booleans on `Contracts` (Lost After Live, Completed Post Live).
```

### `README.md` §Required import fields — REWRITE (full prose, audience = human + agent)

Replace the table with:

> Every field below must round-trip from spreadsheet → database → UI without loss. Each row in her sheet is a deal/contract attached to a meter at a specific service address. The xlsx has 83 columns; the canonical mapping (every column → target table.field) lives at `docs/decisions/06-domain-schema.md`. The summary below covers the **customer-visible** required fields — the schema also captures lifecycle, lost/drop reasons, billing-vs-estimated AQ variance, multi-agent attribution, and commission accounting that the customer doesn't manually enter but the import must preserve.
>
> | Field | Notes |
> |---|---|
> | **Deal Name** | Human label for the deal record |
> | **Customer Name** | Business / account holder |
> | **Primary Contact Name + Title** | The human at the customer org |
> | **Phone** | Contact phone |
> | **Email** | Contact email |
> | **Service Address(es)** | One or more per customer; split into street_no / street_name / address_1 / address_2 / city / state / ZIP / county |
> | **ESI ID** | Electric Service Identifier — ERCOT's unique 17–22-digit identifier for the service address, prefix `1044…` for Oncor territory. **One ESI per service address.** The xlsx labels this "Meter Number" colloquially — canonical industry term is ESI ID and that's what we use across the schema, UI, and any external integration. (See `docs/decisions/06-domain-schema.md` §2 for citations.) |
> | **Physical Meter Serial** | Optional — the device serial printed on the meter. Distinct from ESI ID; changes when meter is swapped. The xlsx captures this as "Meter Id" and we preserve it for cross-reference with supplier invoices. |
> | **Annual Usage / EAC / Billing AQ** | Three related fields. Annual Usage = current snapshot, EAC = estimated at contract signing, Billing AQ = actual billed annual volume. Commissions are paid against Billing AQ in practice — the EAC-vs-Billing variance drives reconciliation work. |
> | **Mils** | Agent commission in mils (thousandths of a dollar) per kWh — see "Agent mils" below |
> | **Supplier** | REP (Retail Electric Provider) on the contract |
> | **Contract Start Date / End Date** | |
> | **Cost per kWh** | Supplier base rate on the contract |
> | **Primary Agent + Secondary Agent** | Both required when xlsx provides both — single-agent assignment in the schema would silently drop the second agent on ~all rows |
> | **Sale Status / Pipeline Stage / Live Status / Lost & Drop reasons** | The schema tracks contract lifecycle across four orthogonal dimensions, not one status field. See decision doc §5. |
> | **Aggregator Name + Aggregator Comm %** | When the broker is a sub-broker under a larger aggregator, the upstream commission % is tracked per contract |
> | **Commission accounting** | Received Amount, Outstanding Amount, Comms Paid / Outstanding (broker → agent) — full reconciliation against expected (Billing AQ × Mils ÷ 1000). Not optional — it's how she gets paid. |

### `CLAUDE.md` §Domain glossary + Conventions — APPEND (caveman)

Append to the glossary list:

```markdown
- **ESI ID** — canonical name. xlsx label "Meter Number" = colloquial. 17–22 digits. Oncor prefix `1044372…`. Tied to service address, not device.
- **Physical Meter Serial** — distinct from ESI ID. Device serial. Swaps on meter replacement.
- **EAC** — Estimated Annual Consumption (kWh). Set at signing.
- **AQ** — Annual Quantity (kWh). Billing AQ = actual billed. Commission paid against AQ, not EAC.
- **Drop** — supplier kicks customer off contract. TX industry term. Distinct from "lost" (customer leaves before/during contract).
- **Aggregator** — upstream broker. When she's a sub-broker, takes a % cut. xlsx cols `Agg Name` + `Agg Comm %`.
- **Pri/Sec Agent** — dual-agent attribution. Every deal can carry 2 agents. House Split % on each agent.
- **Sale Status vs Pipeline Stage** — orthogonal. Sale Status = `Approved`/`Pending`/`Lost`. Stage = pipeline location.
- **Is Live** — contract reached start date + billing began. Distinct from Pipeline Status = `active`.
```

Append to Conventions:

```markdown
- **Round-trip 83 cols.** xlsx has 83 columns (1 dropped constant `Company`, 1 dropped duplicate `Customer Name` at AJ, 6 deferred COVID/historical metrics). 75 round-trip via field mapping at `docs/decisions/06-domain-schema.md`. No silent drops on migration.
- **ESI ID canonical, not "Meter Number".** Import script normalizes xlsx `Meter Number` → `ESI ID`. xlsx `Meter Id` → `Physical Meter Serial` (different field).
- **Dual-agent deals.** `Deals.Primary Agent` + `Deals.Secondary Agent`. Never collapse to one.
- **Contract lifecycle = 4 dims.** Pipeline Status + Is Live + Lost path + Drop path. Don't fold them.
```

### `AGENTS.md` §Domain quick-ref — APPEND (caveman)

Append rows to the domain quick-ref table:

```markdown
| EAC | Estimated Annual Consumption kWh. Signing-time estimate. |
| AQ / Billing AQ | Annual Quantity kWh. Actual billed. Drives commission. |
| Drop | Supplier kicks customer mid-contract. Distinct from "lost." |
| Aggregator | Upstream broker; takes % when we're sub-broker. |
| Pri/Sec Agent | Two agents per deal. |
```

### `HANDOFF.md` — UPDATE (caveman)

In "Decisions locked" append:

```markdown
9. **Schema expanded to 9 tables** (was 8). See `docs/decisions/06-domain-schema.md`. Major deltas: dual-agent on Deals, 4-dim contract lifecycle, AggregatorPayouts table, per-contract commission line items, ESI ID canonical (not "Meter Number").
```

## Open questions

- **Does the CEO ever act as a sub-broker?** If never → `AggregatorPayouts` table stays empty. If sometimes → it's essential. Open question for the next call.
- **3-agent deals?** xlsx caps at 2 (Pri + Sec). If she's ever had a 3-way split, we need a join table `DealAgents` not two fields. Default to 2-field design until she contradicts.
- **`Sale Type` (AS) vs `Acq/Ren` (BO)** — xlsx has both. Migration script must spot-check whether they disagree. If they're always identical, collapse to one field on import.
- **COVID/Normal AQ split (cols AB–AG)** — deferred. Confirm she has no reporting need before deleting from migration scope.
- **`Customer Region`** — what value space? TX-only (Oncor/Centerpoint/AEP/TNMP)? Or broader if she expands? Affects whether to make it a single-select or free string.
- **`Nomination` (AW)** — UK gas-term leftover. Does it carry meaning in her TX workflow, or is it 100% empty post-migration? Confirm.
- **`Source of Lead` value space** — populate single-select from xlsx distinct values during migration design.
- **`Customer Id` (BG) vs xlsx-internal vs CRM-internal** — she may want a stable external ID per customer for cross-system reference (e.g. when supplier statements reference customer by her ID). Preserve as `External Customer Id`.

## Sources

- [electricityplans.com — ESID Lookup](https://electricityplans.com/texas/esid-lookup/)
- [aect.net — Electric Service Identifier](https://www.aect.net/electric-service-identifier-esid)
- [powerwizard.com — ESID Lookup Texas](https://www.powerwizard.com/tools/esid-lookup/)
- [shoptexaselectricity.com — ESI ID Lookup](https://www.shoptexaselectricity.com/learn/texas-esiid-lookup/)
- [myenergenie.com — ESID vs Electric Meter Numbers](https://www.myenergenie.com/esid-vs-electric-meter-key-differences-explained/)
- [ugp.co.uk — EAC FAQ](https://www.ugp.co.uk/support/faqs/billing/#faq-what-is-an-eac)
- [utilityfair.ie — SPC and AQ](https://www.utilityfair.ie/business-energy-insights/gas-tariffs-spc-and-eac)
- [Diversegy — Broker Commissions / Splits](https://diversegy.com/energy-brokers/energy-broker-fees/)
- [Diversegy — Upfront Commissions](https://diversegy.com/about/upfront-energy-commissions/)
- [Diversegy — Early Termination Fees](https://diversegy.com/energy-brokers/early-termination-fees/)
- [Edge On Demand — Broker Commissions](https://www.edgeondemand.com/energy-broker-commissions)
- [Methodia — Commission Management](https://www.methodia.com/blog/commission-management-for-energy-brokers-and-suppliers)
- [Electric Choice — Break Contract](https://www.electricchoice.com/blog/break-contract-provider/)
- [Airtable — Plans (record + field limits)](https://support.airtable.com/docs/airtable-plans)
- [Airtable — Linked Record Field](https://support.airtable.com/docs/linked-record-field)
- [Airtable Community — Max fields per table](https://community.airtable.com/base-design-9/maximum-fields-in-airtable-31111)
