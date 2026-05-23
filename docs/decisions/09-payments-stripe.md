# 09 — Payments provider: Stripe

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

## Verdict

**keep** — Stripe is the right call for genesisxsx-as-platform billing its CRM customers. The decision has a wrinkle, though: the test-key task in `TASKS.md` Phase 0 is wrong-priority and should be pushed back. Greenergiai is a founding customer who almost certainly is not paying through this system yet, so Phase 0 should drop the Stripe item entirely. Pick it up before customer #2 lands — that's when MoR vs Stripe-Tax-DIY actually becomes a live question.

## Decision

1. **Stripe** stays as the payments provider for the genesisxsx → CRM-customers billing relationship.
2. **Stripe Tax** (not Stripe Managed Payments / not Paddle / not Lemon Squeezy) is the tax-compliance approach. US-only customer profile, single-state nexus likely until $500K revenue, no MoR upside that justifies the cost gap.
3. **stripe-node SDK** (latest stable v22.1.1) on the Cloudflare Worker with `httpClient: Stripe.createFetchHttpClient()` and `constructEventAsync(...)` for webhook verification — confirmed-supported pattern, no `nodejs_compat` flag needed.
4. **Phase 0 stripe-key task is deferred.** Move it out of foundation, into a new Phase 6.5 "Billing infrastructure" block, gated on "before customer #2." Greenergiai stays unbilled (founding pilot) until product-validation milestone.
5. **Per-tenant model:** one Stripe Customer per genesisxsx-tenant, one Subscription on that Customer, Worker resolves `Host → tenant → Stripe Customer ID → subscription status → access gate`. Subscription status cached in Supabase (auth DB) and invalidated by Stripe webhooks. Specifics in §Proposed edits.

## Evidence

### 1. CF Workers + stripe-node — confirmed working, exact pattern

The official Cloudflare-Stripe collaboration shipped in 2021 added `Stripe.createFetchHttpClient()` so the SDK works in V8. Confirmed pattern from the official `stripe-samples/stripe-node-cloudflare-worker-template` and a community walkthrough that matches Stripe's own sample:

```js
import Stripe from 'stripe';
const webCrypto = Stripe.createSubtleCryptoProvider();
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});
// Webhook verification — note constructEventAsync, not constructEvent
const event = await stripe.webhooks.constructEventAsync(
  await req.text(), req.headers.get('Stripe-Signature'),
  env.STRIPE_WEBHOOK_SECRET, undefined, webCrypto,
);
```

Key gotcha: **`constructEvent` is sync and breaks in Workers**; use `constructEventAsync` because WebCrypto is async on the Workers runtime. As of stripe-node v11.10.0+ the `node_compat` flag in `wrangler.toml` is no longer required.

Latest stripe-node: **v22.1.1** published 2026-05-06 (GitHub releases API), engines `node >=18`. Pin `^22` in `package.json`.

Sources:
- <https://blog.cloudflare.com/announcing-stripe-support-in-workers/> (2021-11-19 — Cloudflare's announcement of native support)
- <https://github.com/stripe-samples/stripe-node-cloudflare-worker-template> (Stripe's maintained sample)
- <https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/> (community walkthrough with the async-verification gotcha)
- <https://api.github.com/repos/stripe/stripe-node/releases/latest> (v22.1.1, 2026-05-06)

### 2. Tax exposure for a US-based CRM with mostly-US customers

The MoR vs not-MoR decision hinges on geographic mix and SaaS taxability per state. genesisxsx's first customer is a Texas brokerage; future customers are inferred to be similar regional small businesses. That profile dramatically narrows the MoR upside:

- **Texas taxes SaaS at 80% of sale price** (data-processing-service classification). Stripe Guide on SaaS taxability confirms this. Source: <https://stripe.com/guides/introduction-to-saas-taxability-in-the-us>.
- **Texas economic-nexus threshold: $500K gross revenue** (no transaction count). California: same $500K, but SaaS is exempt in CA. Sources: <https://taxcloud.com/blog/sales-tax-nexus-by-state/>, <https://taxcloud.com/sales-tax/texas/>, <https://www.numeral.com/blog/economic-nexus>.
- **Stripe Tax: 0.5% per transaction, only in registered jurisdictions.** No registration → no fee. Source: <https://stripe.com/tax/pricing>.

Translation for genesisxsx: until revenue from a given state crosses that state's threshold (mostly $100K, key states $500K), there's no nexus and no obligation. At the seller's own home state, nexus is physical-presence-based and kicks in from day one — but that's one state to register in, not 50.

For a sub-$100K-revenue CRM selling primarily to a handful of TX/regional small businesses, the operational burden Stripe Tax handles is calculating the right rate per address and surfacing one state's filings. That's $0.50 per invoice extra at most. MoR savings (Paddle 5%+$0.50, Lemon Squeezy ~same, Stripe Managed Payments 6.4%+$0.30 on US cards) don't pay off until you're (a) selling globally and (b) past nexus in 5+ states.

MoR genuinely earns its premium when: international SaaS with EU VAT exposure, B2C with low transaction sizes (per-tx fixed fees hurt), or you literally cannot afford to register in 30 states. None of that applies here.

Sources for MoR cost comparison:
- <https://fintechspecs.com/blog/stripe-vs-paddle-vs-lemon-squeezy-vs-polar-merchant-of-record-b2b-saas/> (Stripe ~2.9% vs Paddle/LS ~5%)
- <https://www.paddle.com/pricing> (Paddle 5% + $0.50)
- <https://stripe.com/managed-payments> (Stripe MoR overview)
- <https://dodopayments.com/blogs/stripe-managed-payments-fees-explained> (Stripe MoR effective fee math: +3.5% on top of base 2.9%+$0.30)

### 3. Sunk-cost analysis

Account `51TYVK6` exists with live publishable key in `.env.production`. Migration cost to MoR = re-register account, redirect webhook endpoints, migrate customer portal, possibly re-issue prices. ~6-12 hours of plumbing, plus losing the existing Stripe dashboard data. Switching pays off only if Stripe's MoR or pricing is materially worse — it isn't, for this profile.

If genesisxsx later expands to international customers (e.g. a Canadian brokerage), revisit Stripe Managed Payments at that point. Public preview opened at Stripe Sessions 2026 (<https://stripe.com/blog/everything-we-announced-at-sessions-2026>), pricing 3.5% on top of base. Same Stripe account, so the migration is in-platform, not a provider swap.

### 4. Per-tenant subscription mapping

The product is multi-tenant by subdomain. Each tenant (greenergiai, future customers) maps to:

```
greenergiai.virecrm.com
  → Host header in Worker
  → tenant_id (from Worker tenant table — currently hardcoded map per TASKS Phase 0)
  → Supabase users.tenant_id (for end-user → tenant association)
  → Stripe Customer ID (stored on tenant record, not on user record)
  → Stripe Subscription status (cached, webhook-invalidated)
  → allow/deny app access at Worker boundary
```

Subscription-status cache lives in Supabase (or KV) keyed by tenant_id, refreshed on `customer.subscription.created/updated/deleted` and `invoice.payment_failed` webhooks. Worker checks cache on every authenticated request — denies with 402 (or redirects to billing portal) on `past_due`, `unpaid`, or `canceled`.

Stripe customer portal handles update-card, cancel, view-invoices for SMB self-serve. Configured via API or Dashboard; deep-linked from the CRM's billing page (`/billing` → portal session → Stripe). Source: <https://docs.stripe.com/customer-management>.

Per-seat pricing is supported if greenergiai-style customers have variable agent counts (`docs.stripe.com/subscriptions/pricing-models/per-seat-pricing`) — confirm with the user when pricing model lands. README's "flat predictable pricing" line points away from per-seat, toward a flat-rate tenant plan + Outlook-seat addon. That maps cleanly to one Stripe Price ID per plan with optional seat addons.

### 5. Customer #1 timing

Greenergiai is a founding pilot. Founding pilots virtually never pay through the production billing flow — they're on a friend-pricing handshake, invoiced ad-hoc, or fully comped. Setting up Stripe in Phase 0 before any customer #2 exists is foundation-theater. The actual blockers in Phase 0 (Airtable PAT, tenant routing, TanStack Start scaffold) all gate the literal first commit; Stripe doesn't gate any pre-customer-2 milestone.

Move it. Build it once we have a second customer in pipeline. This also means we don't burn time wiring webhooks against a key that's idle for months.

## Alternatives

- **Paddle.** 5% + $0.50, full MoR, best global tax coverage. Materially better only for international or 5+ state US revenue. Rejected on profile mismatch + sunk cost. Source: <https://www.paddle.com/pricing>.
- **Lemon Squeezy.** Same MoR model, ~same price as Paddle, indie-SaaS-friendly DX. Stripe-acquired July 2024; in 2026 being folded into Stripe Managed Payments. Still accepting new signups but path-of-least-resistance migration goes toward Stripe anyway. Rejected: pick the destination, not the way-station. Source: <https://www.lemonsqueezy.com/blog/2026-update>.
- **Stripe Managed Payments.** Stripe's own MoR offering, public preview Feb 2026. 3.5% surcharge on top of 2.9%+$0.30. Same Stripe account, future swap is in-platform. Reconsider if customer geography goes international. Source: <https://docs.stripe.com/payments/managed-payments>.
- **FastSpring.** Long-tenured MoR for downloadable software, enterprise-leaning, opaque pricing (sales-call required). Out of scope for a small CRM with a public price list.

## Proposed edits

### `README.md:107-108` → tighten Payments line

old:
```
- **Payments:** Stripe (account `51TYVK6`, currently test-mode key `pk_test_REPLACE_ME` — needs replacing from dashboard).
```

new (full prose):
```
- **Payments:** Stripe (account `51TYVK6`) on the Worker via `stripe-node` with `Stripe.createFetchHttpClient()` and async webhook verification. Stripe Tax (0.5% per taxable transaction) handles US sales-tax calculation per state; we register only in states where economic nexus is crossed. The current `pk_test_REPLACE_ME` placeholder in `.env.development` is deferred — see `docs/decisions/09-payments-stripe.md` for the timing rationale.
```

### `CLAUDE.md` → add payments section under "Architecture" (caveman)

After the "Migration plan." bullet, insert:

```
- **Payments = Stripe on Worker.** `stripe-node` v22+, `httpClient: createFetchHttpClient()`, webhooks via `constructEventAsync` + `createSubtleCryptoProvider()`. One Stripe Customer per tenant, one Subscription. Status cached in Supabase, webhook-invalidated. Stripe Tax for US sales tax — no MoR (Paddle/LS/Managed Payments) until international or multi-state nexus. See `docs/decisions/09-payments-stripe.md`.
```

### `TASKS.md:15` → demote Stripe Phase 0 item

old:
```
- [ ] **Stripe test-key replacement.** `VITE_PAYMENTS_CLIENT_TOKEN` = `pk_test_REPLACE_ME`. Pull live test key from Stripe dashboard (account `51TYVK6`, test mode).
```

new (caveman):
```
- [ ] ~~Stripe test-key replacement~~ — deferred. Greenergiai = founding pilot, unbilled. Pick up before customer #2. See Phase 6.5 + `docs/decisions/09-payments-stripe.md`.
```

### `TASKS.md` after Phase 6 → add Phase 6.5 (caveman)

```
## Phase 6.5 — Billing (gated on customer #2)

- [ ] Stripe test-key replacement. Pull from dash → `.env.development`.
- [ ] `stripe-node` v22+ install. `httpClient: Stripe.createFetchHttpClient()`. Webhooks via `constructEventAsync` + `Stripe.createSubtleCryptoProvider()`.
- [ ] Tenant ↔ Stripe Customer mapping. Worker resolves `Host → tenant → Stripe Customer ID`. Store on tenant record (Supabase or KV).
- [ ] Subscription status cache. `customer.subscription.{created,updated,deleted}` + `invoice.payment_failed` webhooks invalidate. Worker denies 402 on `past_due`/`unpaid`/`canceled`.
- [ ] Stripe Tax on. 0.5%/tx in registered states only. Register TX (home state) at launch; add states only post-nexus.
- [ ] Stripe customer portal. Deep-link from `/billing`. Update card, cancel, invoices.
- [ ] Pricing model decision. Flat tenant plan vs per-seat (README "flat predictable" leans flat + addon). Confirm with user.
- [ ] Webhook endpoint at `/api/stripe/webhooks` in Worker. Idempotent — Airtable has no transactions; same applies here.
```

### `HANDOFF.md:55` → drop Stripe blocker

old:
```
- **Stripe key still `pk_test_REPLACE_ME`** (`.env.development`). Pull from Stripe dashboard, account `51TYVK6`, test mode.
```

new (caveman):
```
- ~~Stripe key blocker~~ — moved to Phase 6.5, gated on customer #2. See `docs/decisions/09-payments-stripe.md`.
```

### `AGENTS.md` → add routing line if doc-routing block exists

If `AGENTS.md` has a "Decisions / docs" routing section, append:
```
- Payments / Stripe / billing → `docs/decisions/09-payments-stripe.md`.
```
(If no such block, skip — don't invent structure.)

## Open questions

1. **Pricing model not yet specified.** README says "flat predictable" — confirm one-Price-per-tenant-plan vs per-seat with Outlook addon. Affects schema in `tenants` table (does it hold a `seat_count`?).
2. **Tenant table location.** Phase 0 says "hardcode map" for tenant routing. When that graduates to a DB-backed table, lives in Supabase or in a separate `tenants` Airtable base. Stripe Customer ID lives wherever this lands. Recommendation: Supabase (auth DB) — keeps billing identity out of customer-domain data.
3. **Foundation customer pricing.** Is greenergiai actually getting comped, or paying a friend rate manually-invoiced? Confirms whether Stripe is needed at all before customer #2.
4. **Webhook endpoint hostname.** `api.virecrm.com/api/stripe/webhooks` vs per-tenant subdomain. One global endpoint is simpler — webhook event includes the Stripe Customer ID, which maps to tenant. Lock this when Phase 6.5 starts.
5. **Stripe Tax on calculate-only vs file.** `Tax Complete` (auto-filing) adds value once nexus in 3+ states. Until then, calculate-only + manual filing in TX is fine.
