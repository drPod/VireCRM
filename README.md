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

Every field below must round-trip from spreadsheet → database → UI without loss. Each row in her sheet is a deal/contract attached to a meter at a specific service address.

### Required import fields

| Field | Notes |
|---|---|
| **Deal Name** | Human label for the deal record |
| **Customer Name** | Business / account holder |
| **Title** | Contact's title at the customer org |
| **Phone** | Contact phone |
| **Email** | Contact email |
| **Service Address(es)** | One or more per customer |
| **ESI Number** | Electric Service Identifier — the Texas meter number, mostly prefixed `1044...` (Oncor territory). **One ESI per service address**, every address must show its ESI. Non-negotiable — this is how every other system in the energy business looks a meter up. |
| **Annual Usage** | kWh/yr at the meter |
| **Mils** | Agent commission in mils (thousandths of a dollar) per kWh — see "Agent mils" below |
| **Supplier** | Electricity supplier on the contract (e.g. retail electric provider) |
| **Contract Start Date** | |
| **Contract End Date** | |
| **Cost per kWh** | Supplier rate on the contract |

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

## Architecture

This is **Project B**: a CRM-as-a-service product on `virecrm.com`. Greenergiai is customer #1 at `greenenergiai.virecrm.com`. More tenants come later.

Decision: **Airtable-as-backend for v1, migrate to Supabase Postgres at customer 10-20 (or first scaling pain).** Speed-to-first-customer wins over architectural purity. Reversible by design.

```
greenenergiai.virecrm.com (TanStack Start SPA)
  ↓
Cloudflare Worker (auth, RLS, caching, Outlook OAuth, batching)
  ↓
Airtable API (one base per customer, single service PAT)
```

Why this hits fast + Project B + reversible:

- **Fast.** Schema = MCP clicks. Formulas (TCV, renewal-days, rollups) native. Kanban view native. Days to her seeing live data, not weeks.
- **Project B.** Custom frontend keeps brand + URL + per-tenant routing. Customer never touches airtable.com.
- **Reversible.** Worker abstracts Airtable. Migration day = swap one module. Frontend unchanged.

## Stack

- **Frontend:** TanStack Start (React + Vite + file-based routing + SSR). Inherited from the prior Lovable scaffold and kept.
- **Backend:** Airtable (workspace `wspBUTSYGFioquhDD`). One base per tenant. Schema mutations via API. Single service PAT held by the Worker — customers never get an Airtable seat.
- **API layer:** Cloudflare Worker (`src/server.ts`). Handles auth, per-tenant routing by Host header, RLS, caching, batching against Airtable's 5 req/sec limit, Outlook OAuth.
- **Auth (for our app users):** Supabase Auth (`coynbufhejaeuifpvmvw.supabase.co`). Customer Postgres is *not* the data store right now — it just holds users + sessions until we migrate the domain data off Airtable.
- **Payments:** Stripe (account `51TYVK6`, currently test-mode key `pk_test_REPLACE_ME` — needs replacing from dashboard).
- **Deploy:** Cloudflare Workers via Wrangler. Routes in `wrangler.jsonc` cover `virecrm.com` (canonical) and `majix.ai/*` (308 → virecrm). Wildcard `*.virecrm.com/*` carries the tenant subdomains.
- **Package manager:** Bun only. Foreign lockfiles git-ignored.

## Future / probable features (lower confidence, surface in next call with her)

These weren't asked for but the energy-brokerage domain suggests they'll come up. Listed here so we don't blindside ourselves later — confirm scope with her before building.

- **Usage upload via PDF.** Customers email 12-month bills; OCR extracts kWh history → seeds pricing quotes. Removes manual data entry. Big lift — needs her to confirm she actually wants this vs. continuing to key it in.
- **DocuSign / e-sign on contracts.** May already be in her workflow via DocuSign directly; integrate vs. ignore is a real choice.
- **Tasks / reminders per deal.** Generic CRM affordance ("call back Tuesday"). Build only if she'll use it — otherwise dead UI.
- **Customer-facing portal.** `customers.virecrm.com` route already exists in `wrangler.jsonc` — implies prior intent. Customer logs in, sees own meters/contracts/rates. Reduces "what's my rate?" inbound. Confirm whether MVP or v2.

