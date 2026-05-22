# stripe-node v22+ (fetch HTTP client for Cloudflare Workers)

**Snapshot:** 2026-05-22
**Origin:** https://docs.stripe.com
**Sync:** `scripts/sync-stripe-node-docs.sh` (idempotent)

Verbatim mirror of Stripe's official docs for the Node SDK, scoped to what `genesisxsx` actually uses: Workers runtime (`fetch` HTTP client + WebCrypto), webhook signature verification (`constructEventAsync`), Checkout, and Stripe Tax.

Stripe ships both an HTML doc site and a `.md` LLM-flavor mirror. We pull `.md` for verbatim grounding; pages without `.md` are dropped, not scraped from HTML.

## When to consult this mirror

Use these files (in this order) before `WebFetch`, `context7`, or grep on `stripe`:

1. **stripe-node SDK questions** (init, Workers fetch client, async webhook verify) → `reference.md` + `webhooks-signatures.md`.
2. **API surface / capability discovery** → `llms.txt` (full Stripe docs index — 91KB, grep it).
3. **Pricing or migration of Checkout flow** → `payments-checkout.md`.
4. **Stripe Tax registration / nexus / flow** → `tax.md`.
5. **CLI + dev loop** (`stripe listen`, fixtures, test mode) → `development-environment.md`.

`docs/decisions/09-payments-stripe.md` carries the genesisxsx-specific call: Stripe + Stripe Tax (~3.4% total) chosen over MoR providers; webhook verify via `constructEventAsync` + `Stripe.createSubtleCryptoProvider()`; payment work deferred to customer #2.

## Files

| File | Size | Consult when | Key symbols |
|---|---:|---|---|
| `llms.txt` | 91 KB | You need to grep the full Stripe doc index for any topic — auth, products, balance, connect, identity, etc. Indexes every `.md` page Stripe ships. | (index only) |
| `reference.md` | 4 KB | Writing webhook verify code or test signatures. Source = `stripe-node` README + v8 migration wiki via context7. | `webhooks.constructEvent`, `webhooks.generateTestHeaderString`, `new Stripe(apiKey, {...})` |
| `sdks-node.md` | 3 KB | Picking SDK + language (Node listed alongside Ruby/Python/PHP/Java/Go/.NET). Confirms which official lib to use. | (links to GitHub repos per language) |
| `development-environment.md` | 102 KB | Stripe CLI install, `stripe listen` flow, test-mode keys, fixtures, idempotency keys, common errors, Workers/Edge runtime notes. Largest single doc — grep it. | `stripe login`, `stripe listen --forward-to`, `stripe trigger`, `--api-key`, `Idempotency-Key` |
| `webhooks-signatures.md` | 62 KB | Verifying signature headers, secret rotation, replay protection, async verify path for Workers (WebCrypto), error handling. | `Stripe-Signature`, `constructEvent`, `constructEventAsync`, `Stripe.createSubtleCryptoProvider`, `whsec_*` |
| `payments-checkout.md` | 8 KB | Building a Stripe Checkout flow — hosted vs embedded, success/cancel URLs, Session creation, subscription mode. | `checkout.sessions.create`, `mode: 'subscription'`, `success_url`, `client_reference_id` |
| `tax.md` | 6 KB | Enabling Stripe Tax, registration prerequisites, US sales tax nexus model, 0.5% per-transaction fee, automatic tax on Checkout / Subscriptions / Invoices. | `automatic_tax: { enabled: true }`, registrations, nexus thresholds |
| `_urls.txt` | <1 KB | Provenance — which upstream URL maps to which local file. | — |
| `_snapshot_date.txt` | <1 KB | Snapshot date stamp. Compare to `git log` of this directory to assess staleness. | — |

## Workers integration recap

Not in upstream docs — read alongside. Authoritative version lives in `docs/decisions/09-payments-stripe.md`.

- `new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() })` — never the Node http agent.
- Webhook: `await stripe.webhooks.constructEventAsync(rawBody, sigHeader, secret, undefined, Stripe.createSubtleCryptoProvider())`. Sync `constructEvent` fails on Workers; HMAC verify needs async WebCrypto.
- `stripe-node` v11.10.0+ does not require `nodejs_compat` for itself. Flag stays on in `wrangler.jsonc` for `node:buffer` / `node:crypto`.
- `sk_live_*` + webhook secrets → `wrangler secret put` only. `pk_live_*` safe in `.env.production`.

## Refresh

`bash scripts/sync-stripe-node-docs.sh` rebumps the `.md` mirrors. `reference.md` regenerates via `mcp__context7__query-docs` against `/stripe/stripe-node` — see the script's header for the exact query.
