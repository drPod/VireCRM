# 04 — Auth provider: Supabase Auth

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

Vetting record for the auth-provider decision made in `CLAUDE.md` (§Architecture) and `wrangler.jsonc` (`SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` in `vars`).

Dated 2026-05-22. Stack picks fixed for this unit: Airtable backend, TanStack Start + CF Workers + Bun, Stripe payments, MS Graph for Outlook.

## Verdict

**Keep Supabase Auth.** Decision survives scrutiny on every axis that matters for this product:

- **Workers compat is solved** — `@supabase/server` (May 2026 public beta) verifies JWTs in CF Workers without Node, using JWKS cached at the Supabase edge for 10min. No special SDK fork required.
- **Pricing is generational** — Supabase Free tier covers 50k MAU at $0. The realistic ceiling for this product (customer #20 × ~5 agents = 100 MAU) is rounding error against the cap. Clerk at the same scale is also $0, but Clerk's B2B Organizations is a separate $100/mo add-on the moment we want tenant grouping. WorkOS is free to 1M MAU but charges $125/connection for SAML and is overkill for a 5-agent brokerage.
- **Sunk-infra factor is real** — Supabase project `coynbufhejaeuifpvmvw` already provisioned. Switching to Clerk = re-provision dashboard, swap envs, rewrite Worker JWT verification, change Vite client SDK. Not catastrophic (~4-8 hours) but no payoff at this scale.
- **Future-DB alignment** — The Phase-2 migration target is Supabase Postgres (per `README.md` §Architecture: "migrate to Supabase Postgres at customer 10-20"). Picking Supabase Auth now is the only option that gives `auth.uid()` natively inside RLS policies at migration time. Picking Clerk now means writing all RLS in app code forever — a strictly worse multi-tenant story when domain data leaves Airtable.

The one real risk — trusting a spoofable `tenant_id` from `user_metadata` — is mitigated by putting tenant claims into `app_metadata` (server-only writable) and verifying every request server-side in the Worker. This is the documented Supabase pattern, not a workaround.

## Decision

**Auth provider = Supabase Auth (project `coynbufhejaeuifpvmvw`).**

Concrete shape:
- **JWT verification in Worker via `@supabase/server`** (Web-API-standard, runs in CF Workers per Supabase's May 2026 announcement). Uses Supabase's asymmetric JWT (ECC `ES256` or RSA) verified against `/auth/v1/.well-known/jwks.json`, cached at edge for 10min. No HS256 (Supabase strongly discourages).
- **Tenant claim lives in `app_metadata.tenant_id`** (and `app_metadata.role` for in-org RBAC). `app_metadata` is server-write-only; `user_metadata` is user-writable and MUST NOT be trusted for authorization decisions.
- **Custom Access Token Hook** (Pro tier, included) writes `tenant_id` + `role` into the access token at issue time, so the Worker can read it from the verified JWT without an extra DB round trip.
- **Worker treats absent or unknown `tenant_id` as 403.** No fallback to "default tenant," no inference from Host header alone — Host header determines _expected_ tenant; JWT claim determines _actual_ tenant; mismatch = 403.
- **Auth model = one Supabase project, multi-tenant via `tenant_id` in `app_metadata`.** Not project-per-tenant (operationally insane at 10+ tenants per the Supabase consensus pattern).
- **Customer-portal (`customers.virecrm.com`) uses the same project** with a `role: customer` claim and a separate tenant scope. Magic-link email signup, no password setup friction. Same JWKS, same Worker verification path.

## Evidence

### Q1 — Feature parity (Supabase Auth vs Clerk vs WorkOS vs Better Auth vs Auth.js v5)

Comparison matrix below pulls from each vendor's current docs. Citations inline.

| Feature | Supabase Auth | Clerk | WorkOS AuthKit | Better Auth |
|---|---|---|---|---|
| Email/password, magic link, OAuth | Free | Free | Free | Self-host |
| MFA (TOTP) | Free | Free | Free | Plugin |
| MFA (Phone) | $75/mo first project | Paid | Free | n/a |
| SAML SSO | $0.015/MAU (Pro) | $75/mo per connection over 1 | $125/conn (1-15), volume disc | Plugin |
| Organizations / B2B | DIY in app + RLS | $100/mo add-on | First-class | First-class plugin |
| Custom RBAC | Custom Access Token Hook | Built-in | Built-in | Built-in |
| Audit logs | 1h Free / 7d Pro / 28d Team | 1d Free / 30d Business | $99-125/mo add-on | DIY |
| CF Workers native | `@supabase/server` (May 2026) | `@clerk/backend` V8 isolate | HTTP API | edge-compat Postgres driver req'd |
| Multi-tenant pattern | One project + `tenant_id` claim | Organizations primitive | Organizations primitive | Org plugin |

Sources:
- Supabase pricing + features per [supabase.com/pricing](https://supabase.com/pricing)
- Clerk pricing per [clerk.com/pricing](https://clerk.com/pricing)
- WorkOS pricing per [workos.com/pricing](https://workos.com/pricing)
- Better Auth feature scope per [GitHub better-auth/better-auth](https://github.com/better-auth/better-auth) and [auth0alternatives.com Supabase Auth vs Better Auth](https://www.auth0alternatives.com/compare/supabase-auth/vs/better-auth)
- Comparison synthesis per [makerkit.dev Better Auth vs Clerk vs NextAuth vs Supabase 2026](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk)

For this product (5 agents per customer, single REP brokerage in TX, no enterprise customers asking for SAML yet), Supabase Auth's feature set is sufficient. SAML need is hypothetical — if a brokerage with corporate IT shows up demanding SSO, Pro tier turns it on at $0.015/MAU.

### Q2 — Multi-tenant JWT shape, trust boundary

Supabase JWT payload (per [JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)) carries both `app_metadata` and `user_metadata` as optional claims:

- **`user_metadata`** — written by the client via `supabase.auth.updateUser({ data: {...} })`. **User-writable. NEVER trust for authorization.** A compromised client could set `user_metadata.tenant_id = "anyone"`.
- **`app_metadata`** — written by the server via service-role admin API. **Server-only. Safe to trust** once the JWT signature is verified.

Per the [Custom Claims & RBAC guide](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) and [community discussion #30381](https://github.com/orgs/supabase/discussions/30381), the canonical pattern is:

1. On signup, server (admin client) sets `app_metadata.tenant_id` and `app_metadata.role`.
2. **Custom Access Token Hook** ([docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)) optionally rewrites the JWT at issue time to flatten/promote claims for ease of RLS use.
3. Worker verifies JWT signature → reads `app_metadata.tenant_id` → uses as the only source of tenant truth.
4. Host header (`greenenergiai.virecrm.com`) is used only for routing the SPA shell. The Worker MUST cross-check that the JWT's `tenant_id` matches the expected tenant for the Host. Mismatch = 403.

**Risk surface if Worker skips JWT verification:** total tenant breach. A signed-in greenergiai user could swap their `Authorization` bearer for any other tenant's token (or forge one) and read that tenant's Airtable base. This is the single most important invariant in `CLAUDE.md` ("Never trust JWT tenant claim without verification") — Supabase Auth doesn't change the burden, but the burden is real.

### Q3 — CF Worker JWT verification

**Three paths, ranked best to worst for this product:**

1. **`@supabase/server` (preferred).** Per [Introducing @supabase/server (May 6, 2026)](https://supabase.com/blog/introducing-supabase-server): public beta, supports "any runtime or platform that supports the standard Request/Response Web API including Supabase Edge Functions, Vercel Functions, Cloudflare Workers, Bun, Deno." Handles JWKS fetch + caching + signature verification internally. Adopt this; no need to roll our own.
2. **`jose` library + manual JWKS fetch.** Per Supabase JWT docs ([supabase.com/docs/guides/auth/jwts](https://supabase.com/docs/guides/auth/jwts)), the JWKS endpoint at `/auth/v1/.well-known/jwks.json` is "served directly from the Auth server, but is also additionally cached by the Supabase Edge for 10 minutes." `jose` is Web-Crypto-API compatible, runs in Workers natively. Fall back to this if `@supabase/server` doesn't fit our shape.
3. **HS256 + shared secret.** Documented but Supabase "strongly discourages" — and rotation is brutal. Skip.

**Latency comparison vs Clerk:**
- Supabase: first request fetches JWKS (~100ms cold), subsequent requests verify with cached key (~1ms).
- Clerk via `@clerk/backend`: configure `CLERK_JWT_KEY` (PEM public key from dashboard) → **zero-network-roundtrip** verification per [Verifying Clerk JWTs in Cloudflare Workers](https://www.subaud.io/verifying-clerk-jwts-in-cloudflare-workers/). Slightly better cold-start.

The Clerk edge is real but ~100ms cold-start once per JWKS rotation interval is irrelevant for this product. The Worker already eats 5-50ms hitting Airtable's 5-req/sec API. Auth verification is not on the critical path here.

### Q4 — Pricing curve

Modeled against the customer-growth trajectory in `README.md` (greenergiai = customer #1, migration target = customer 10-20).

| Stage | MAU est. | Supabase Auth | Clerk | WorkOS | Better Auth |
|---|---|---|---|---|---|
| Customer 1 (greenergiai) | ~5 (agents only) | $0 | $0 | $0 | DB hosting only |
| Customer 1 + portal (~50 customers) | ~50-100 | $0 | $0 | $0 | DB hosting only |
| Customer 10 (50 total agents + ~500 portal users) | ~550 | $0 | $0 | $0 | DB hosting only |
| Customer 100 (5000 MAU) | 5000 | $25/mo (Pro base) | ~$20/mo + add-ons | $0 | $25/mo DB Pro |
| Customer 100 + SAML demand | 5000 + 5 SSO | $25 + 75 ≈ $100/mo | $20 + 75×5 + 100 (orgs) ≈ $495/mo | $0 + 125×5 = $625/mo | DIY plugin |

**Read:** at the realistic 10-customer milestone we're at $0 across all four options. At 100 customers, Supabase wins on B2B/SSO pricing. Clerk's Organizations add-on alone ($100/mo) destroys its price advantage the moment we offer a customer-portal with org grouping. WorkOS is built for big-enterprise SSO and prices accordingly.

Sources (all live as of 2026-05-22):
- [Supabase pricing](https://supabase.com/pricing) — 50k Free MAU, then $0.00325/MAU; SAML $0.015/MAU; Pro $25/mo
- [Clerk pricing](https://clerk.com/pricing) — 50k Free MRU; $20/mo Pro; Orgs add-on $85-100/mo; SAML $75/mo per connection
- [WorkOS pricing](https://workos.com/pricing) — 1M Free MAU; SAML $50-125/connection; AuthKit free

### Q5 — Sunk-infra factor

Supabase project `coynbufhejaeuifpvmvw` is already provisioned. Specifically already done:
- Project created (~$0 sunk cost in dollars; ~30min in setup time across the team)
- Domain configured (`https://coynbufhejaeuifpvmvw.supabase.co`)
- Publishable key generated (`sb_publishable_AfxTcWiGW7j882pfkhPhwg_hKKdSAW2`) and committed to `wrangler.jsonc` + `.env.*`

Switching to Clerk would require:
1. Provision Clerk project (~15min)
2. Re-issue publishable + secret keys, update Wrangler vars and Vite envs (~15min)
3. Replace any planned `@supabase/server` imports with `@clerk/backend` (~1-2 hours given no code exists yet — bigger if rewriting later)
4. Reset the planned RLS strategy at Phase 2 (Postgres migration) — Clerk → Postgres has no `auth.uid()` equivalent, RLS becomes app-layer (~indefinite cost)

**Net:** at zero LoC written, the dollar-and-hours switching cost is ~4-8 hours. The real cost is foregoing the Postgres-Auth integration story at Phase 2. Decision: keep Supabase Auth.

### Q6 — Future lock-in

**Counter-intuitive finding:** Supabase Auth is _less_ locked in than Clerk when domain data migrates to Supabase Postgres, because:

- Supabase Auth tables (`auth.users`, `auth.sessions`) live in YOUR Postgres database. Exit = `pg_dump` and run Auth somewhere else (or replace it). Per [makerkit.dev comparison](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk), Supabase lock-in is rated "Low — Postgres exit possible."
- Clerk holds user records in Clerk's database. Exit = export via API, rewrite app, lose session continuity. Same source rates Clerk lock-in "High."
- Better Auth has zero lock-in (your DB, your tables) — but the dependency on edge-compat Postgres driver complicates CF Workers deployment per [hono.dev Better Auth on Cloudflare](https://hono.dev/examples/better-auth-on-cloudflare), and we don't even have a Postgres yet (we're on Airtable Phase 1).

**Net:** Supabase Auth has the right lock-in shape for THIS product because we're migrating TO Supabase Postgres anyway. Auth and domain data converge on the same DB — no second migration needed, no `auth.uid()` plumbing to write in app code.

### Q7 — Customer portal angle (`customers.virecrm.com`)

The customer-portal route exists in `wrangler.jsonc` lines 29 + 34. Confirmed open question in `HANDOFF.md` (Q4). When it launches, it needs:

- **Different UX from agent auth.** Agents log in with email+password (or magic link). Customers shouldn't have to remember a password — magic-link or passkey is friendlier.
- **Different scope.** Customer JWT must NOT carry `tenant_id` that lets them read other customers in the same tenant base. Need `customer_id` claim instead, with finer-grained RLS / Worker filtering.
- **Same project, separate role.** `app_metadata.role: customer` vs `app_metadata.role: agent`. Worker dispatches based on the role.

**Supabase Auth handles this trivially** — magic link is a single auth method, and the same Custom Access Token Hook can branch on role to attach the right scope claim. Clerk would do this fine too. WorkOS is overkill for customer-portal-style passwordless. Better Auth handles it but we'd own the impl.

**Decision:** Supabase Auth covers both audiences. No second auth provider needed.

## Alternatives considered (and why rejected)

- **Clerk.** Best DX, strongest CF Workers SDK (`@clerk/backend` with `CLERK_JWT_KEY` for zero-RTT verification), best B2B Organizations primitive. **Rejected because:** $100/mo Organizations add-on hits the moment we want customer-portal grouping; lock-in is "High" per makerkit.dev; doesn't align with the Phase-2 Postgres migration target (no `auth.uid()` in RLS).
- **WorkOS AuthKit.** Massive free MAU tier (1M), best-in-class enterprise SSO. **Rejected because:** $125/connection SAML pricing is enterprise-scale, irrelevant here; AuthKit is newer and less battle-tested than Supabase Auth for the small-SaaS sweet spot; no DB integration story for Phase-2.
- **Better Auth (self-hosted).** Zero lock-in, $0 cost beyond DB, native Organizations + RBAC. **Rejected because:** requires Postgres-now (we're on Airtable until customer 10-20); needs edge-compatible Postgres driver (Neon serverless or Supabase pooler) for CF Workers; we'd own all auth bugs; Supabase Auth's `auth.uid()` integration is uniquely better for our future Postgres+RLS state.
- **Auth.js v5 (NextAuth).** **Rejected because:** we're on TanStack Start, not Next.js — Auth.js v5 is Next-shaped and the framework-agnostic core is less mature. No multi-tenant primitives. Migration cost without compensating benefit.
- **Roll-your-own JWT + bcrypt in Worker.** **Rejected because:** we want to ship, not maintain a CVE-attracting auth surface. Password reset flows, OAuth, MFA, session revocation — none are 1-week problems; all are solved by Supabase Auth's free tier.

## Proposed edits

### `README.md:106` → replace existing auth line with explicit lock-in framing

**Old (line 106):**
```
- **Auth (for our app users):** Supabase Auth (`coynbufhejaeuifpvmvw.supabase.co`). Customer Postgres is *not* the data store right now — it just holds users + sessions until we migrate the domain data off Airtable.
```

**New:**
```
- **Auth (for our app users):** Supabase Auth (`coynbufhejaeuifpvmvw.supabase.co`). Verified in the Worker via `@supabase/server` (asymmetric JWT, JWKS-cached). Tenant claim lives in `app_metadata.tenant_id` (server-write-only — never trust `user_metadata` for authorization). Customer Postgres is *not* the data store right now — it just holds users + sessions until we migrate the domain data off Airtable. Picking Supabase Auth now aligns with the Phase-2 Postgres migration target: `auth.uid()` will be available natively in every RLS policy when domain data moves over, with no second auth migration.
```

### `CLAUDE.md:18` → expand "Supabase Auth only" with the trust boundary rule

**Old (line 18):**
```
- **Supabase Auth only.** No domain data in Postgres yet. Just users + sessions. Domain data = Airtable until migration.
```

**New:**
```
- **Supabase Auth only.** Project `coynbufhejaeuifpvmvw`. No domain data in Postgres yet — users + sessions only. Domain data = Airtable until customer-10-20 migration. Worker verifies Supabase JWT via `@supabase/server` (asymmetric, JWKS-cached). Tenant claim = `app_metadata.tenant_id` ONLY — `user_metadata` is user-writable, never trust it for tenant routing or authz. Host header determines expected tenant; JWT claim determines actual; mismatch = 403.
```

### `CLAUDE.md:48` → tighten "Worker is the auth + RLS boundary" with concrete claim

**Old (line 48):**
```
- **Worker is the auth + RLS boundary.** Never expose Airtable PAT to frontend. Never trust JWT tenant claim without verification.
```

**New:**
```
- **Worker = auth + RLS boundary.** Never expose Airtable PAT to frontend. Verify every JWT signature against Supabase JWKS (asymmetric, ES256/RS256 — never HS256). Read tenant from `app_metadata.tenant_id`, not `user_metadata`. Cross-check JWT tenant matches Host-header tenant. Customer-portal JWTs carry `role: customer` + `customer_id`, NOT `tenant_id` — agent and customer scopes diverge.
```

### `TASKS.md:44` → make Phase 1.5 auth gate concrete

**Old (line 44):**
```
- [ ] **Auth gate.** Supabase JWT verified in Worker. JWT claim → tenant. Tenant → Airtable base. No tenant in JWT = 403.
```

**New:**
```
- [ ] **Auth gate.** Adopt `@supabase/server` in Worker. Verify Supabase JWT (asymmetric, JWKS). Read tenant from `app_metadata.tenant_id` (never `user_metadata`). Cross-check tenant matches Host header. No tenant in `app_metadata` = 403. Mismatch with Host = 403.
- [ ] **Custom Access Token Hook (Pro tier, when we get there).** Inject `tenant_id` + `role` into JWT at issue time so Worker reads from verified claim, not a DB round trip. Free-tier path: read `app_metadata` directly from the JWT (already there if set via admin API).
- [ ] **Tenant provisioning script.** New customer onboard = `supabase.auth.admin.updateUserById(uid, { app_metadata: { tenant_id, role } })`. Document in `docs/runbooks/onboard-tenant.md`.
```

### `HANDOFF.md:24` → tighten the "Auth" decision line

**Old (line 24):**
```
7. **Auth:** Supabase Auth only — no domain data in Postgres yet.
```

**New:**
```
7. **Auth:** Supabase Auth (`coynbufhejaeuifpvmvw`). Verified in Worker via `@supabase/server`. Tenant claim = `app_metadata.tenant_id` (server-write-only). No domain data in Postgres yet — users + sessions only. Reviewed against Clerk/WorkOS/Better Auth/Auth.js v5 in `docs/decisions/04-auth-supabase.md`.
```

### `AGENTS.md:42` → reinforce the auth invariant alongside other stack invariants

**Old (line 42):**
```
- **Airtable backend** (do not migrate to Postgres without explicit decision).
```

**New (insert after this line):**
```
- **Airtable backend** (do not migrate to Postgres without explicit decision).
- **Supabase Auth via `@supabase/server`.** Tenant lives in `app_metadata.tenant_id` only. Worker cross-checks JWT tenant against Host header.
```

## Open questions

1. **When to enable Custom Access Token Hook.** Free-tier `app_metadata` reads work for now (claim is already in the JWT). Hook is Pro-tier and only earns its keep if we want JWT-side schema flexibility. Defer until Phase 1.5 implementation reveals a concrete need.
2. **Customer-portal launch timing.** Per `HANDOFF.md` Q4, still TBD whether portal launches with MVP or v2. Auth design accommodates either — but if launching with MVP, plan magic-link UX and `role: customer` scoping in Phase 1.5, not deferred.
3. **Email-uniqueness gotcha for multi-tenant.** Per [Supabase multi-tenancy guide](https://medium.com/@kriryk/multi-tenant-authentication-with-supabase-a-production-implementation-0f6064f50d55), Supabase enforces global email uniqueness — one email can only belong to one user account across the whole project. If a customer's CEO is also an agent at another brokerage tenant, they'd need two emails OR we use the "internal-email-per-tenant + display-email" pattern from the guide. Confirm: does greenergiai's CEO need access at any other tenant? Almost certainly no for now; flag if it changes.
4. **Audit log retention need.** Supabase Free = 1h, Pro = 7d, Team = 28d ([supabase.com/pricing](https://supabase.com/pricing)). For a CRM holding customer commission data, 7d feels thin if a compliance question lands. Defer the call — we're on Free at customer #1, decision lands when we move to Pro.
5. **MFA mandate.** Supabase Free covers TOTP MFA. Phone MFA = $75/mo. For a brokerage CEO + ~5 agents handling commission data, TOTP via authenticator app is the right floor. Confirm with darsh/CEO whether MFA is mandatory at MVP.

---

Sources consulted (for completeness):
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase JWT verification guide](https://supabase.com/docs/guides/auth/jwts)
- [Introducing @supabase/server (May 6, 2026)](https://supabase.com/blog/introducing-supabase-server)
- [Supabase Custom Access Token Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Multi-tenant Authentication with Supabase (Medium, Kriryk)](https://medium.com/@kriryk/multi-tenant-authentication-with-supabase-a-production-implementation-0f6064f50d55)
- [Clerk pricing](https://clerk.com/pricing)
- [Verifying Clerk JWTs in Cloudflare Workers (subaud.io)](https://www.subaud.io/verifying-clerk-jwts-in-cloudflare-workers/)
- [WorkOS pricing](https://workos.com/pricing)
- [Better Auth on Cloudflare (Hono docs)](https://hono.dev/examples/better-auth-on-cloudflare)
- [Auth0Alternatives — Supabase Auth vs Better Auth](https://www.auth0alternatives.com/compare/supabase-auth/vs/better-auth)
- [makerkit.dev — Better Auth vs Clerk vs NextAuth vs Supabase Auth 2026](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk)
- [Supabase Discussion #30381 — Custom claims: app_metadata or new key?](https://github.com/orgs/supabase/discussions/30381)
