# genesisxsx

CRM for the CEO of **greenergiai**, a Texas energy-brokerage business. Built for sales agents who source commercial electricity contracts and earn commission ("mils") on top of supplier rates.

Deployed at **https://greenenergiai.virecrm.com/** (per-customer subdomain on the `virecrm.com` zone).

The repo was recently wiped and is being rebuilt.

## Why custom instead of Go High Level

She was on Go High Level and walked away. The point of this build is to fix the specific things that drove her off, not to pile on features she'll never touch. Research-backed pain points that mapped to her experience:

1. **CSV imports silently drop non-standard columns.** GHL requires every custom field to be pre-created in Settings → Custom Fields *before* the import will map it. If you skip that, only the standard fields (Customer Name, Email, Phone) come through; everything else — ESI numbers, mils, suppliers, dates, usage — gets dropped on the floor with no warning. This is exactly what happened to her. Our import must be schema-aware out of the box: every column on her master sheet must round-trip with zero pre-config.
2. **Outlook integration is a minefield.** Outlook Desktop events don't sync (cloud-only), on-prem Exchange isn't supported, "Outlook 2-way Sync" is buried in a Labs toggle that ships off, attachments over 3 MB break the sync, OAuth tokens silently expire and need manual reconnect, and event-type calendars don't support Outlook at all (Google only). She wants Outlook to just work.
3. **GHL is architected for marketing agencies, not single-business owners.** Sub-accounts, white-label, SaaS Mode, reseller billing — none of that applies to her one-business operation with a handful of agents. The $97/mo Starter is "overkill for solo operators" per consensus reviews, and the $297/mo Unlimited is agency-shaped surface area she'd never use. She pays for and navigates around a product built for someone else.
4. **The CRM module itself is weak.** Reviews consistently say the CRM is "not as intuitive as Pipedrive" — GHL is a marketing suite with a CRM bolted on, not a CRM. She needs a CRM.
5. **Steep learning curve, non-intuitive UI.** Top negative tags on G2 are "Learning Curve" and "Not Intuitive." Reviewers budget 4-6 weeks of dedicated setup. She's a non-technical CEO running a business — six weeks fighting agency software is the abandonment trigger.
6. **Hidden usage-based costs.** $97 base plus per-email, per-SMS, per-AI-interaction billing. Sticker shock on top of the sticker price.

### Product principles this build locks in

- **One-shot migration that respects her sheet.** Her existing xlsx imports cleanly into the live system once at launch. Every column lands. No "create custom fields first" gate, no silent drops. Errors surface row-by-row. This is a one-time migration pain point we solve up front — not a recurring user-facing feature.
- **First-class domain model, not generic CRM primitives.** Deals, Customers, Service Addresses, ESIs, Contracts, Mils, TCV are real entities with their own UI — not duct-taped onto a generic "Contact" with 12 custom-field text boxes.
- **Outlook that works on day one.** Two-way sync default-on. Office 365 + Exchange Online. No buried Labs toggles, no silent token expiry without prompts to reconnect.
- **Single-tenant simplicity.** No sub-accounts, no white-label, no agency mode. One business, one CEO, a few agents, one pipeline view.
- **Flat predictable pricing.** No per-email, per-SMS gotchas. If something costs us (e.g. Outlook OAuth seats), it's named explicitly.
- **Non-technical UI as the bar.** If she can't do it without a tutorial, it's the wrong UI. Onboarding to first-deal-imported should be under 10 minutes.

## The master list (source of truth: `Copy of NGP MASTER LIST - Copy.xlsx`)

Every field in her sheet must round-trip from spreadsheet → database → UI without loss. Each row is a deal/contract attached to a meter at a specific service address. The xlsx has 83 columns and 5,445 data rows — the canonical column-by-column mapping (every xlsx column → target table.field, including the ones the customer doesn't manually enter but the import must preserve) lives at [`docs/decisions/06-domain-schema.md`](docs/decisions/06-domain-schema.md). The summary below covers the **customer-visible** required fields; the schema also captures contract lifecycle (lost/drop reasons, live status, post-live completion), dual-agent attribution, billing-vs-estimated annual quantity variance, and aggregator/sub-broker commission chains.

### Required import fields

| Field | Notes |
|---|---|
| **Deal Name** | Human label for the deal record |
| **Customer Name** | Business / account holder |
| **Primary Contact Name + Title** | The human at the customer org (xlsx `contact_person` + `designation`) |
| **Phone** | Contact phone |
| **Email** | Contact email |
| **Service Address(es)** | One or more per customer; split into street_no / street_name / address_1 / address_2 / city / state / ZIP / county |
| **ESI ID** | Electric Service Identifier — ERCOT's unique 17–22-digit identifier for the service address, prefixed `1044372…` for Oncor territory (or `1017699…` for East TX). **One ESI per service address**, every address must show its ESI. Non-negotiable — this is how every external system (REPs, TDUs, ERCOT lookups) looks a meter up. The xlsx labels this "Meter Number" colloquially, but the canonical industry term is ESI ID and that's what we use across the schema, UI, and any external integration. The ESI ID is tied to the service address and persists through meter replacements. |
| **Physical Meter Serial** | Optional — the device serial printed on the physical meter. **Distinct from ESI ID**; changes when the meter is swapped. The xlsx captures this as "Meter Id" and we preserve it for cross-reference with supplier invoices. |
| **Annual Usage / EAC / Billing AQ** | Three related fields. Annual Usage is the current snapshot, EAC (Estimated Annual Consumption) is set at contract signing, and Billing AQ (Annual Quantity) is the actual billed annual volume. Commissions are paid against Billing AQ in practice, and the EAC-vs-Billing variance drives most reconciliation work. |
| **Mils** | Agent commission in mils (thousandths of a dollar) per kWh — see "Agent mils" below. The xlsx labels this "Unit Uplift." |
| **Supplier** | REP (Retail Electric Provider) on the contract |
| **Contract Start Date / End Date** | |
| **Cost per kWh** | Supplier base rate on the contract |
| **Primary Agent + Secondary Agent** | Every deal can carry two agents. The xlsx has `Pri Agent` and `Sec Agent` columns; both must round-trip. A single-agent assignment would silently drop the second agent on most rows. |
| **Sale Status / Pipeline Stage / Live Status / Lost & Drop reasons** | The schema tracks contract lifecycle across four orthogonal dimensions, not one status field. See `docs/decisions/06-domain-schema.md` §5. |
| **Aggregator Name + Aggregator Comm %** | When the broker operates as a sub-broker under a larger aggregator, the upstream commission percentage is tracked per contract. |
| **Commission accounting** | Received Amount, Outstanding Amount, Comms Paid / Outstanding (broker → agent) — full reconciliation against the expected commission (Billing AQ × Mils ÷ 1000). Not optional; this is how she actually gets paid and reconciles against supplier statements. |

## Pipeline + tabs

The CRM has a sales pipeline with stages. The two tabs the CEO called out:

### "In Pricing" tab

Surfaces deals in the **pre-won stage** where pricing is being quoted to the customer. The deal that's currently being priced should be the one that feeds into this tab. This is the staging ground before a deal is closed-won.

### "Current Clients" tab

When a deal reaches **Stage 1** (won/closed), the deal record graduates from the pipeline into the Current Clients tab. This is the live book of business: every active contract, organized by customer, with all ESIs, supplier terms, dates, and rates visible.

The transition is one-way and automatic — closing a deal in the pipeline pushes it to Current Clients. No double entry.

## Agent mils & total contract value

When a deal is closed, the agent records their **agent mils** — the per-kWh adder (in mils) the agent is making on top of the supplier's base rate. This number drives the **Total Contract Value** calculation:

```
Total Contract Value = Annual Usage (kWh) × Contract Term (years) × Agent Mils ÷ 1000
```

(Mils are thousandths of a dollar, so dividing by 1000 converts mils-per-kWh into dollars-per-kWh.)

TCV must be displayed on each closed deal and aggregated on the agent / customer / overall dashboard.

## Outlook integration

The CEO wants email tied to deals. Build an **Outlook integration** for her!

## Architecture + stack

See [`CLAUDE.md`](CLAUDE.md) for stack invariants and [`docs/decisions/`](docs/decisions/) for the 10 load-bearing picks (data backend, frontend, auth, multi-tenancy, Outlook, domain schema, caching, migration triggers, payments, consistency).

## Future / probable features (lower confidence, surface in next call with her)

These weren't asked for but the energy-brokerage domain suggests they'll come up. Listed here so we don't blindside ourselves later — confirm scope with her before building.

- **Usage upload via PDF.** Customers email 12-month bills; OCR extracts kWh history → seeds pricing quotes. Removes manual data entry. Big lift — needs her to confirm she actually wants this vs. continuing to key it in.
- **DocuSign / e-sign on contracts.** May already be in her workflow via DocuSign directly; integrate vs. ignore is a real choice.
- **Tasks / reminders per deal.** Generic CRM affordance ("call back Tuesday"). Build only if she'll use it — otherwise dead UI.
- **Customer-facing portal.** `customers.virecrm.com` route already exists in `wrangler.jsonc` — implies prior intent. Customer logs in, sees own meters/contracts/rates. Reduces "what's my rate?" inbound. Confirm whether MVP or v2.

