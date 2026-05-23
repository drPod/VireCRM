# 03 — Multi-tenancy strategy

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

## 1. Verdict

| Sub-decision | Verdict |
|---|---|
| 1a. One Airtable base per tenant | **keep** |
| 1b. Single service PAT scoped workspace-wide | **tweak** — pin scope to *current workspace bases only*, add per-tenant override path for high-value tenants, plan rotation hygiene |
| 1c. Subdomain routing via `Host` header | **keep** |
| 1d. Tenant resolution storage = hardcoded map | **tweak** — move to Workers KV at customer ~3, before manual ops becomes a deploy blocker |

## 2. Decision being vetted (verbatim)

From `CLAUDE.md:16`:
> **Airtable = data backend.** One base per tenant. Workspace `wspBUTSYGFioquhDD`. Single service PAT held by Worker. Customers never touch airtable.com.

From `CLAUDE.md:17`:
> **Worker = only Airtable client.** Frontend talks to Worker, never to Airtable directly. Worker handles auth, tenant routing by Host header, RLS, caching (5 req/sec ceiling), batching (10 records/req), Outlook OAuth.

From `CLAUDE.md:51`:
> **Batch reads/writes.** 10 records/req. Cache hot reads in Worker. 5 req/sec per base is the hard ceiling.

From `TASKS.md:16`:
> **Airtable service PAT.** Create scoped PAT in Airtable (`data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, `webhook:manage`). Store in Worker secrets (`wrangler secret put AIRTABLE_PAT`).

From `TASKS.md:17`:
> **Tenant routing in Worker.** Read `Host` header → resolve tenant → return tenant's Airtable base ID + branding context. Hardcode map `greenenergiai.virecrm.com → base <id>` for now. Wildcard route already covered in `wrangler.jsonc`.

From `wrangler.jsonc:35`:
> `{ "pattern": "*.virecrm.com/*", "zone_name": "virecrm.com" }`

## 3. Evidence

### 3a. Airtable workspace + base limits

- **1500 bases per workspace.** Universal cap across all plans per [Airtable plans overview](https://support.airtable.com/docs/airtable-plans). 1500 tenants per workspace = far beyond any realistic 2026 ceiling for this product.
- **Records per base:** Free 1k, Team 50k, Business 125k, Enterprise Scale higher (contact sales). Each tenant's base counts independently against its own record limit, not a shared pool — direct upside of one-base-per-tenant.
- **API calls per workspace per month:** Free 1k, Team 100k, **Business unlimited**. Per [Airtable plans overview](https://support.airtable.com/docs/airtable-plans). At ~10 tenants on Team plan, 100k/month ÷ 10 = ~10k calls/tenant/month = ~14 calls/hour/tenant. **This is the real ceiling, not bases.** Worker-side caching (already planned, CLAUDE.md:51) is non-optional past customer ~3 on Team plan.

### 3b. Airtable rate limits — base-scoped vs. token-scoped

Per [Airtable API rate limits](https://airtable.com/developers/web/api/rate-limits) (verbatim):
- **5 req/sec per base** — independent budget per base. Each tenant base has its own 5 RPS budget. One-base-per-tenant horizontally scales request throughput linearly.
- **50 req/sec per PAT / service account** — this is the **real ceiling at ~10 tenants if reads happen concurrently.** At customer 11 the single-PAT model would oversubscribe even if each tenant only hits 5 RPS.
- **429 response → wait 30s.** Airtable JS client has built-in backoff.

### 3c. PAT scoping options (2026)

Per [Airtable PAT support docs](https://support.airtable.com/docs/creating-personal-access-tokens):
> "a single base, multiple bases—including bases from different workspaces—all of the current and future bases in a workspace you own, or even all of the bases from any workspace that you own including bases/workspace added in the future."

- **PAT can be scoped to one workspace** (current + future bases) → preferred over "all workspaces" for blast-radius limiting.
- **Per-base PAT alternative is viable but costly** — each tenant needs PAT minted, stored as Wrangler secret, rotated independently. At 10 tenants that's 10 `wrangler secret put` invocations + 10 rotation calendars + 10 audit trails.
- **Scopes available** ([Airtable scopes API](https://airtable.com/developers/web/api/scopes)): `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, `webhook:manage`, plus `data.recordComments:read/write`, `workspacesAndBases:read`, `block:manage`, `user.email:read`. TASKS.md:16 list is correct.
- **No mandatory PAT expiration / rotation policy stated in Airtable docs** — rotation is operator discipline, not platform-enforced.

### 3d. Cloudflare for SaaS — custom hostnames

Per [Cloudflare for SaaS plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/) and [May 2025 changelog](https://developers.cloudflare.com/changelog/post/2025-05-19-paygo-updates/):
- **100 custom hostnames free** on Free / Pro / Business plans. Beyond that: **$0.10/hostname/month**.
- **Pay-as-you-go ceiling raised to 50,000** custom hostnames (was 5,000).
- **Wildcard `*.virecrm.com/*` already in `wrangler.jsonc:35`** — covers all subdomains via Worker route. For SSL on customer-owned domains (e.g. `crm.customer.com`) we'd add Cloudflare for SaaS custom hostname records; for our own subdomain pattern (`*.virecrm.com`), the wildcard route + zone-level SSL is sufficient until first customer brings their own domain.
- **DCV provisioning latency:** TXT tokens "ready after a few seconds" per [TXT DCV docs](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/txt/). Total cert issuance after DNS propagation is typically minutes, not hours. Programmatic onboarding via [Create Custom Hostname API](https://developers.cloudflare.com/api/resources/custom_hostnames/methods/create/) is straightforward — `POST` then `GET` with delay to fetch DCV records.

### 3e. Shared-base + tenant column — viability

Community discussion at [Airtable Community: multi-tenant base ideas](https://community.airtable.com/base-design-9/multi-tenant-base-ideas-45420) is mostly about **native Airtable Interfaces** (where current-user-email filters are the only RLS mechanism, and synced-table cross-base filters don't work). **Our case is different** — RLS lives in our Worker, not in Airtable's native UI. So community warnings about synced-table leakage don't apply directly.

However, shared-base-with-tenant-column has hard problems regardless of access path:
- **`filterByFormula` on every read** — `{tenant_id}='cust_x'` injected into every list call. Adds query cost + must never be omitted (any forgotten predicate = full-tenant leak).
- **Linked records cross-tenant** — Airtable linked-record fields point at any record in the table. A misconfigured pick-list could surface tenant B's customer in tenant A's dropdown.
- **Single-select option lists are global to the table** — REP/supplier list, deal-stage list. Either all tenants share the same options (lose customization) or you fork per tenant via complex naming hacks.
- **Record limits collapse into one bucket** — Team plan's 50k records/base now serves all tenants. At ~5 tenants × 10k records each = at cap.
- **Backup/restore granularity = zero** — can't snapshot or restore one tenant without touching others.
- **Schema migrations are blast-radius events** — every tenant affected by every schema change.

### 3f. Single PAT blast radius

If the workspace-scoped PAT leaks:
- All current + future bases in `wspBUTSYGFioquhDD` exposed.
- Mitigation: PAT lives only in Worker secrets (`wrangler secret put`), never in code or env files (CLAUDE.md:59-60 already enforces this).
- Mitigation: scope to **`wspBUTSYGFioquhDD` current+future bases only** (not "all workspaces") — limits blow radius to this product's bases, doesn't reach personal Airtable workspaces.
- Mitigation: rotate quarterly + on any departure + immediately on any suspected leak. Document in `docs/runbook/secrets.md` (not yet written).

Per-customer PAT alternative:
- **Cost:** 10× rotation calendars at 10 tenants. Manageable but real ops overhead.
- **Benefit:** PAT leak only exposes one tenant's data.
- **Verdict:** not worth the complexity at <10 tenants. Revisit at customer ~10 or first regulated-industry tenant (HIPAA / SOC 2).

### 3g. Subdomain routing storage — hardcoded vs. KV vs. D1 vs. DO

Per [Cloudflare Workers storage options](https://developers.cloudflare.com/workers/platform/storage-options/):
- **Hardcoded map in Worker source:** zero infra, zero RTT. Breaks when adding a tenant requires a `wrangler deploy`. Fine for 1-3 tenants. Each new tenant = a code change PR.
- **Workers KV:** "config data...read at high rates...not typically modified" — exact fit. Reads ~10ms from nearest POP. ~1s propagation on writes. Free tier covers our scale (100k reads/day).
- **D1 (SQLite):** overkill for a tenant→base-id lookup. Right answer when tenant config grows past key/value (e.g. tenant-specific feature flags, billing state, audit log).
- **Durable Objects:** wrong fit for routing lookup. Right for per-tenant *state* (rate limiter token bucket, webhook subscription state) — not for resolution.

**Cutover:** hardcode until customer ~3, then KV. Don't bother with D1 until tenant config needs joins or transactional updates.

### 3h. Path-based alternative

`virecrm.com/greenenergiai/...` instead of `greenenergiai.virecrm.com/...`:

Right when:
- White-label not desired (admins/dashboards, not customer-facing).
- SSL cost per hostname is prohibitive (not the case here — 100 free).
- Customer onboarding can't tolerate any DNS provisioning latency (not the case — we control DNS).

Wrong here because:
- README §Product principles (lines 21-27) implies "brand feels like ours" — subdomain reads as a per-customer product.
- Path-based has cookie + CORS scoping pain — all tenants share `virecrm.com` cookie scope unless we set per-path cookies (fragile).
- Subdomain isolates `Origin` header for CORS, `Host` for routing, cookies by domain attribute. Cleaner boundary.

## 4. Alternatives considered

### 4a. Shared base + tenant column + `filterByFormula`

**When right:**
- Heavy cross-tenant analytics needed (aggregate "all customers' total kWh"). Unlikely for energy brokerage CRM.
- Tenant count >>1500 (workspace cap). Far beyond plausible scale.

**Why not here:**
- RLS becomes "every query must remember the predicate" — one omission = data leak.
- Record limit collapses into one bucket (50k Team plan).
- No per-tenant backup/restore.
- Schema changes touch every tenant simultaneously.
- 5 req/sec budget is now shared across all tenants instead of multiplying.

### 4b. Per-customer PAT

**When right:**
- Regulated industry (HIPAA / SOC 2) — single-tenant blast radius required for audit.
- Customer paying for premium isolation tier.

**Why not now:**
- Rotation overhead × tenant count. 10× more `wrangler secret put` + 10 rotation calendars at customer 10.
- Marginal security gain vs. workspace-scoped PAT in Worker secret (already isolated from frontend per CLAUDE.md:60).
- **Revisit at customer ~10 or first regulated tenant.**

### 4c. Path-based routing (`virecrm.com/<tenant>/...`)

**When right:**
- B2B admin tools where brand isn't a sales lever.
- Multi-tenancy without per-customer DNS / SSL automation.

**Why not here:**
- Subdomain is the brand signal (`greenenergiai.virecrm.com` reads as "this company's CRM").
- Cookie/CORS scoping cleaner per subdomain.
- CF for SaaS gives us 100 free hostnames + $0.10/each beyond — cost is negligible.

### 4d. Hybrid: one shared base for small tenants → split at threshold

**When right:**
- Tenant SLA tiers (free trial = shared base; paid = own base).
- Aggregate analytics demand.

**Why not here:**
- Adds a migration path (shared → split) we'd have to build + test. Cost > benefit at v1.
- Greenergiai is our first customer at paid tier — no free / trial tenants in the plan.
- One-base-per-tenant from day one keeps the path linear.

## 5. Proposed agent-file edits

### `CLAUDE.md:16` — sharpen PAT scope + tenant-routing storage

**Replace lines 16-17 (verbatim):**
```
- **Airtable = data backend.** One base per tenant. Workspace `wspBUTSYGFioquhDD`. Single service PAT held by Worker. Customers never touch airtable.com.
- **Worker = only Airtable client.** Frontend talks to Worker, never to Airtable directly. Worker handles auth, tenant routing by Host header, RLS, caching (5 req/sec ceiling), batching (10 records/req), Outlook OAuth.
```

**With (caveman):**
```
- **Airtable = data backend.** One base per tenant. Workspace `wspBUTSYGFioquhDD`. Workspace-scoped service PAT (current + future bases in `wspBUTSYGFioquhDD`, NOT "all workspaces"). Held by Worker. Customers never touch airtable.com. PAT rotation: quarterly + on departure + on suspected leak.
- **Worker = only Airtable client.** Frontend talks to Worker, never to Airtable directly. Worker handles auth, tenant routing by Host header (KV lookup past customer ~3, hardcoded map until then), RLS, caching (5 req/sec per base + 50 req/sec PAT-aggregate ceiling), batching (10 records/req), Outlook OAuth.
```

### `CLAUDE.md:51` — sharpen rate-limit guidance

**Replace line 51:**
```
- **Batch reads/writes.** 10 records/req. Cache hot reads in Worker. 5 req/sec per base is the hard ceiling.
```

**With:**
```
- **Batch reads/writes.** 10 records/req. Cache hot reads in Worker (TTL 30-60s). **Two ceilings:** 5 req/sec per base AND 50 req/sec aggregate per PAT — the PAT ceiling bites at ~10 concurrent tenants, not the per-base one. Plan accordingly.
```

### `TASKS.md:16` — pin PAT to workspace scope

**Replace line 16:**
```
- [ ] **Airtable service PAT.** Create scoped PAT in Airtable (`data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, `webhook:manage`). Store in Worker secrets (`wrangler secret put AIRTABLE_PAT`).
```

**With:**
```
- [ ] **Airtable service PAT.** Create PAT scoped to **workspace `wspBUTSYGFioquhDD` (current + future bases only — NOT "all workspaces I own")**. Scopes: `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, `webhook:manage`. Store in Worker secrets (`wrangler secret put AIRTABLE_PAT`). Document rotation cadence in `docs/runbook/secrets.md`.
```

### `TASKS.md:17` — flag KV cutover at customer ~3

**Replace line 17:**
```
- [ ] **Tenant routing in Worker.** Read `Host` header → resolve tenant → return tenant's Airtable base ID + branding context. Hardcode map `greenenergiai.virecrm.com → base <id>` for now. Wildcard route already covered in `wrangler.jsonc`.
```

**With:**
```
- [ ] **Tenant routing in Worker.** Read `Host` header → resolve tenant → return tenant's Airtable base ID + branding context. Hardcode map `greenenergiai.virecrm.com → base <id>` until customer ~3. Migrate to Workers KV at that point — write keys `tenant:<host>` → `{baseId, branding, planTier}`. Wildcard route already covered in `wrangler.jsonc:35`. Don't reach for D1 / Durable Objects yet.
```

### `TASKS.md:42` — add PAT-aggregate ceiling to Phase 1.5 client

**Replace line 42 (in Phase 1.5):**
```
- [ ] **Airtable client module.** `src/server/airtable.ts` — typed wrapper over Airtable REST API. Batches reads (10/req), respects 5 req/sec, exposes domain-shaped functions (`getCustomer`, `listDealsForStage`, `closeDeal`).
```

**With:**
```
- [ ] **Airtable client module.** `src/server/airtable.ts` — typed wrapper over Airtable REST API. Batches reads (10/req), respects **5 req/sec per base + 50 req/sec PAT-aggregate** (token-bucket across all tenant base IDs), exposes domain-shaped functions (`getCustomer`, `listDealsForStage`, `closeDeal`). 429 → 30s backoff per [docs](https://airtable.com/developers/web/api/rate-limits).
```

### `README.md` — architecture section, add multi-tenancy boundary detail

**Replace lines 81-93 (full prose):**
```
## Architecture

This is **Project B**: a CRM-as-a-service product on `virecrm.com`. Greenergiai is customer #1 at `greenenergiai.virecrm.com`. More tenants come later.

Decision: **Airtable-as-backend for v1, migrate to Supabase Postgres at customer 10-20 (or first scaling pain).** Speed-to-first-customer wins over architectural purity. Reversible by design.

\`\`\`
greenenergiai.virecrm.com (TanStack Start SPA)
  ↓
Cloudflare Worker (auth, RLS, caching, Outlook OAuth, batching)
  ↓
Airtable API (one base per customer, single service PAT)
\`\`\`
```

**With:**
```
## Architecture

This is **Project B**: a CRM-as-a-service product on `virecrm.com`. Greenergiai is customer #1 at `greenenergiai.virecrm.com`. More tenants come later. Each tenant gets a dedicated subdomain (`<tenant>.virecrm.com`) backed by a dedicated Airtable base inside the shared workspace `wspBUTSYGFioquhDD`.

Decision: **Airtable-as-backend for v1, migrate to Supabase Postgres at customer 10-20 (or first scaling pain).** Speed-to-first-customer wins over architectural purity. Reversible by design.

\`\`\`
greenenergiai.virecrm.com (TanStack Start SPA)
  ↓
Cloudflare Worker (auth, RLS, caching, Outlook OAuth, batching)
  ↓  uses Host header → resolves tenant → tenant's Airtable base ID
Airtable API (one base per tenant, workspace-scoped service PAT)
\`\`\`

**Multi-tenancy boundaries:**
- **Isolation:** each tenant is a separate Airtable base. No shared tables, no `filterByFormula` RLS gymnastics, no cross-tenant linked-record leakage.
- **Routing:** Worker reads `Host` header. Until customer ~3, a hardcoded map (`greenenergiai.virecrm.com → base ID`) lives in `src/server/tenants.ts`. After that, Workers KV holds `tenant:<host>` → `{baseId, branding, planTier}`.
- **Credentials:** one service PAT, scoped to workspace `wspBUTSYGFioquhDD` only (current + future bases — never "all workspaces I own"). Held in Wrangler secret `AIRTABLE_PAT`. Rotated quarterly. Per-tenant PATs revisited at customer ~10 or first regulated-industry tenant.
- **Rate limits:** Airtable enforces 5 req/sec **per base** AND 50 req/sec **per PAT/service account**. Worker token-bucket honors both. The PAT-aggregate ceiling is the real constraint at ~10+ tenants — not the per-base one.
- **SSL:** zone-level cert on `*.virecrm.com` covers all `<tenant>.virecrm.com` automatically. If a customer brings their own domain (`crm.customer.com`), we add a Cloudflare for SaaS custom hostname: 100 free, $0.10/each beyond, DCV via TXT or HTTP.
```

### `HANDOFF.md:21` — sharpen decision 4 (architecture)

**Replace line 21:**
```
4. **Architecture:** SPA (TanStack Start) → CF Worker → Airtable API. See README.
```

**With (caveman):**
```
4. **Architecture:** SPA (TanStack Start) → CF Worker → Airtable API. One base per tenant in workspace `wspBUTSYGFioquhDD`. Worker resolves tenant via `Host` header (hardcoded map → KV at customer ~3). Workspace-scoped PAT, not "all workspaces". See README + `docs/decisions/03-multi-tenancy.md`.
```

## 6. Open questions

1. **First customer bringing their own domain?** Cheapest answer is "no, use `<tenant>.virecrm.com`." If a future customer (e.g. greenergiai itself, post-trust-build) wants `crm.greenenergiai.com`, we cross the CF for SaaS custom hostname bridge then — not now.
2. **Tenant signup automation.** No multi-tenant self-onboarding flow planned in TASKS.md. New tenants = manual ops (create base via MCP → add KV row → set branding). Fine for sub-10 tenants. Becomes a deploy bottleneck at customer ~10. Revisit then.
3. **Backup / DR policy.** One-base-per-tenant gives per-tenant snapshot granularity. But Airtable snapshots have to be triggered manually or via API. Need a daily cron-driven export-per-tenant story. Out of scope here, write a `docs/runbook/backup.md` later.
4. **Cross-tenant analytics for greenergiai-the-owner.** None planned. If she ever wants "total kWh across all my agent franchisees," that's a Postgres-migration trigger, not a shared-base trigger.
5. **PAT rotation cadence + runbook location.** Mentioned in proposed edits as `docs/runbook/secrets.md` — needs writing.
