# 07 — Caching, Rate Limit & Webhook Strategy

Vetting decisions in `CLAUDE.md` §Conventions and `TASKS.md` Phase 1.5:

1. KV read cache, TTL 30–60s, invalidate on writes.
2. Airtable 5 req/sec per base — Worker batches + throttles.
3. Batch writes 10 records/req.
4. Daily cron refreshes Airtable webhooks (7-day expiry).

## Verdict

**Mostly correct, but three edits required:**

| Decision | Verdict | Edit |
|---|---|---|
| 5 req/sec ceiling | Correct, math works for the greenergiai load with significant headroom. | Add note: 429 → 30 s lockout, plan retry path. |
| Cache TTL 30–60s | Too long for the read pattern; **shorten to 10–20 s**, or switch to per-isolate in-Worker LRU + a "freshness pulse" model. | Change `TASKS.md` Phase 1.5 + `CLAUDE.md` conventions. |
| Invalidate on writes | Correct intent but **KV propagation is not instant** (≤60 s across regions). For a single-tenant single-region Worker this is a non-issue, but the *agent writing the record* must read-through, not from KV. | Add read-through-after-write rule. |
| Daily cron refresh | Works but wasteful at one cron slot per tenant. **Single global cron + per-base last-touched check** is cheaper and scales past tenant #1. | Change refresh strategy. |
| Webhooks pre-Outlook | **Not needed for Phases 0–3.** Only Worker writes to Airtable in those phases, so it already knows when state changed. Defer webhook plumbing to Phase 5 (Outlook reverse-flow). | Move webhook line out of Phase 1.5, into Phase 5. |
| Batch 10/req | Confirmed correct for 2026. No change. | None. |

## Decision (revised)

1. **Cache layer = in-Worker LRU first, KV second.**
   - Per-isolate in-memory `Map<key, {value, expiresAt}>` capped at a few hundred entries (LRU).
   - Cold-isolate fallback → KV with TTL 10 s.
   - Bypass cache on the request that *just wrote* (read-through-after-write).
2. **Rate limiting.** Single in-Worker token bucket per Airtable base, 5 tokens/sec refill, max burst 5. Queue overflows; surface 503 if queue depth > 20.
3. **Batch writes.** Keep 10/req. Chunk arrays > 10 into sequential 10-record calls, each costing one token from the bucket.
4. **Webhooks.**
   - **Phases 0–3: do not implement.** Frontend can't edit Airtable, only the Worker can, so there's nothing to be notified about.
   - **Phase 5 (Outlook inbound):** stand up webhooks; single global Worker cron at `0 */6 * * *` (every 6 h) iterates registered webhooks per tenant base, refreshes any whose `lastRefreshedTime` > 5 days. Free-tier safe (250 cron triggers/account, well under).

## Evidence

### 1. Airtable 5 req/sec ceiling — confirmed for 2026

> "Airtable enforces a rate limit of 5 requests per second (per base) to ensure optimal user performance across all pricing tiers."
> — [Managing API call limits in Airtable](https://support.airtable.com/docs/managing-api-call-limits-in-airtable) (page updated 2026-05-12)

> "If you exceed this rate, you will receive a 429 status code and will need to wait 30 seconds before subsequent requests will succeed."
> — [Airtable API Rate Limits](https://airtable.com/developers/web/api/rate-limits)

30 s lockout is the part the existing docs miss — a single mis-batched request blocks the *entire base* for half a minute, which is a UX cliff. The token bucket prevents it; without one a Kanban re-render that fans out 6 reads at once will trip it.

### 2. Batch endpoint still 10/req in 2026

> "The maximum batch size for create, update, and delete operations is 10 records per request. This allows you to process multiple records per request instead of one at a time. Batching can handle up to 10 records per request."
> — [Managing API call limits in Airtable](https://support.airtable.com/docs/managing-api-call-limits-in-airtable)

5 batched writes/sec × 10 records = 50 records/sec ceiling per base. Holds for the 5,500-row import (110 s minimum; budget 3 min with retries).

### 3. KV consistency — eventually consistent, ≤60 s

> "Changes may take up to 60 seconds or more to be visible in other global network locations as their cached versions of the data time out."
> — [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

> "KV isn't suitable for write-heavy workloads requiring strong consistency. For applications needing atomic operations, Cloudflare recommends Durable Objects instead."
> — same page

Implication for cache invalidation: if Agent A writes a deal in Dallas and Agent B reads it from a Worker in Atlanta seconds later, B can still see the stale value for up to 60 s. **For greenergiai (5 agents, mostly Texas, one user actively closing a deal at a time) this is invisible.** Becomes a real problem only when multiple agents edit the same record concurrently — not the day-1 access pattern.

### 4. KV pricing — read cost dominates

> Paid plan: "Keys read: 10 million/month, + $0.50/million" / "Keys written: 1 million/month, + $5.00/million."
> — [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)

At 6 active users * ~5 reads/min * 8 h * 22 days = ~317 k reads/month per tenant. Free tier covers it 30× over.

### 5. Durable Objects for strong consistency

> "Each Durable Object has durable storage attached that is strongly consistent yet fast to access."
> — [Durable Objects overview](https://developers.cloudflare.com/durable-objects/)

> Paid: "Requests: 1 million / month, + $0.15/million" — "Duration: 400,000 GB-s / month, + $12.50/million GB-s"
> — [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

DO is the right answer if/when we need cross-region atomicity (e.g. "lock this ESI while close-deal flow runs"). Day-1 single-tenant Texas operation doesn't justify the per-isolate cost yet.

### 6. Cron Triggers — 250/account on Paid

> "Number of Cron Triggers per account" — "5 for Workers Free, 250 for Workers Paid plans" (account-level, not per-Worker).
> — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Free tier supports 5 cron triggers. The original plan ("daily cron per base") burns one slot per tenant — at tenant #6 we hit the free-tier wall. **Single global cron iterating tenants is the better shape.**

### 7. Airtable webhook lifecycle

> "Webhooks created with personal access tokens or OAuth access tokens will expire and be disabled after 7 days."
> "The webhook life will be extended for 7 days from the refresh time."
> — [Webhooks overview](https://airtable.com/developers/web/api/webhooks-overview)

Refresh-only-when-stale (>5 days since last touch) cuts requests vs daily blanket refresh; the 2-day safety margin still covers a missed cron tick.

### Load math — per-tenant peak req/sec to Airtable

Assumptions: greenergiai = 1 CEO + 5 agents = 6 concurrent users. Kanban polled via TanStack Query at default `staleTime` (we'll set explicit `refetchInterval`). Cache layer = 10 s in-Worker LRU.

| Flow | Trigger | Calls before cache | Calls after cache (10s LRU) | Notes |
|---|---|---|---|---|
| Kanban open (cold) | first user opens pipeline | 1 list-deals call (1 base req) | 1 | 100 rows ≤ default page size |
| Kanban open (warm) | other 5 users open same view inside 10 s | 0 | 0 | LRU hit |
| Kanban auto-refresh | `refetchInterval: 15000` per user | 6 reqs / 15 s = 0.4 req/s | 1 req / 10 s = 0.1 req/s | One isolate-level fetch refreshes for all users on same isolate |
| Deal detail open | user clicks a card | 1 reads(records by id) per user | ≤1 / 10 s per record-id | Per-record cache key |
| Close-deal write | won button | 3 writes (deal stage, contract record, esi link) | 3 writes — bypass cache | Idempotent w/ retry |
| Drag-drop stage change | one card moved | 1 write | 1 | Bypass cache, invalidate `deals:list` key |
| Bulk xlsx import | one-shot at launch | 550 batches of 10 writes | 550 writes throttled to 5/s = ~110 s | Idempotent; runs offline |
| Renewal cron | daily, server-side | 1 view query | 1 | No user impact |

**Steady-state peak under 1 req/sec.** Hard cap (5/sec) only relevant during import (handled by token bucket) and pathological close-deal storms (≤3 writes per close). The decision is safe with double-digit headroom.

### Why TTL 10 s, not 30–60 s

Three flows make 30–60 s too long for a Kanban:

1. **User drags card Lead → Qualified.** TanStack Query optimistic update paints it immediately, then refetch fires after `refetchInterval`. If the refetch hits a 45 s stale cache, the card snaps back to Lead for the user. UX bug.
2. **Two agents in pipeline at the same time** — agent A closes a deal, agent B sees Lost or Won lag by up to a minute. Trust-eroding.
3. **The actual saving is small.** The math table shows the cap isn't req/sec, it's *KV reads*. 10 s vs 60 s only matters if peak demand outpaces 5/sec, and it doesn't.

10 s is enough to absorb the rapid-fire reads (page open, hover, sub-component fetch within 1–2 s of each other) without holding stale data across human reaction time.

The right primitive is in-Worker LRU (cold-isolate-aware) not KV. KV is the cross-region fallback for cold isolates only.

## Alternatives considered

| Option | Why not |
|---|---|
| KV everywhere, no in-Worker LRU | Pays the global propagation tax (≤60 s) for a workload that's regional. Costs reads we don't need to pay for. |
| Durable Objects for cache | Strong consistency unneeded at day 1. $0.15/M req + $12.50/M GB-s adds line items for a problem we don't have. Revisit at multi-tenant scale or close-deal lock requirement. |
| D1 for cache | SQLite is a DB, not a cache. Wrong primitive. We will use D1 *if/when we move off Airtable*, not for caching the current Airtable layer. |
| No cache, raw Airtable hits | Steady state is 0.4–1 req/sec — fits inside the 5/sec budget without a cache. But: drops the bucket every Kanban re-render, no protection against bulk operations, no story for renewal cron + user fetch overlap. |
| Webhooks now (Phase 1.5) | Frontend can't write to Airtable, Worker is the only writer, so it already knows when state changed. Build only for inbound-from-Outlook (Phase 5). |
| Per-base cron refresh | Burns 1 of 5 free-tier cron slots per tenant. Single global cron iterating bases scales further on the same budget. |

## Proposed edits

### `CLAUDE.md:46-52` — replace Conventions cache/batch/webhook lines

```
## Conventions

- **Schema-first.** Domain entities (Customer / ServiceAddress / ESI / Contract / Deal / Agent / LOA / CommissionStatement) are real Airtable tables, not custom fields on a generic Contact.
- **Worker is the auth + RLS boundary.** Never expose Airtable PAT to frontend. Never trust JWT tenant claim without verification.
- **Idempotent writes.** Airtable has no transactions. Close-deal flow must tolerate retry without duplicating state.
- **Batch reads/writes.** 10 records/req. Cache hot reads in Worker (per-isolate LRU, TTL 10 s). KV fallback for cold isolates. Read-through-after-write — request that just wrote bypasses cache.
- **Rate limit.** 5 req/sec per base. Token bucket throttles. 429 = 30 s base-wide lockout — must not trip.
- **Webhooks deferred to Phase 5.** Pre-Outlook, Worker is sole writer; nothing to subscribe to.
```

### `TASKS.md:42-44` — Phase 1.5 cache + webhook lines

```
- [ ] **Read cache.** Per-isolate LRU in Worker (TTL 10 s, ~256 entries cap). KV fallback for cold-isolate misses (TTL 10 s). Invalidate on writes; the writing request bypasses cache (read-through-after-write). KV propagation is eventually consistent (≤60 s) — acceptable for single-region single-tenant day-1, revisit at multi-region scale.
- [ ] **Token-bucket rate limiter.** Per-base limiter in Worker. 5 tokens/sec refill, max burst 5. Queue overflow, return 503 if queue > 20. Prevents 30 s lockout on 429.
```

Delete the webhook line in Phase 1.5. Add to Phase 5:

### `TASKS.md:76-83` — append to Phase 5 (Outlook integration)

```
- [ ] **Airtable webhooks (deferred from 1.5).** Register webhook per tenant base for tables the Outlook reverse-flow needs to watch (`Deals`, `Customers`). Single global cron `0 */6 * * *` iterates `webhooks:list`, refreshes any with `lastRefreshedTime > 5d ago`. 7-day expiry, 5-day refresh = 2-day safety margin.
```

### `README.md:104-106` — Architecture API-layer bullet, full prose

Old:
> **API layer:** Cloudflare Worker (`src/server.ts`). Handles auth, per-tenant routing by Host header, RLS, caching, batching against Airtable's 5 req/sec limit, Outlook OAuth.

New:
> **API layer:** Cloudflare Worker (`src/server.ts`). The Worker handles authentication (Supabase JWT), per-tenant routing by Host header, row-level security, caching, batching, rate limiting against Airtable's 5 req/sec-per-base ceiling, and Outlook OAuth. Reads are cached in a per-isolate LRU (TTL 10 s) with a Workers KV fallback for cold isolates. Writes go through a token-bucket limiter (5 tokens/sec refill, max burst 5) and the Airtable batch endpoint (10 records/request), so the absolute write ceiling is 50 records/second per tenant base. The request that performs a write bypasses the read cache so the caller never sees their own stale data. Airtable webhooks are only wired up at Phase 5 (Outlook reverse-flow); pre-Outlook the Worker is the sole writer, so there is nothing external to subscribe to.

### `HANDOFF.md` — add to "Decisions locked"

```
9. **Cache + rate limit.** Per-isolate LRU (TTL 10 s) + KV fallback. Token-bucket limiter, 5/s per base. Batch writes 10/req. Webhooks deferred to Phase 5.
```

## Open questions

1. **How does TanStack Query interact with the Worker cache?** Default `staleTime: 0` will hammer the Worker; we should set `staleTime: 5000` minimum on list queries so the client doesn't bypass our LRU. Confirm via context7 docs at implementation time.
2. **Do we want a "freshness pulse" endpoint?** A cheap `HEAD /api/deals/last-updated` that returns max-updated-at lets the client decide if it needs to refetch. Saves the LRU read entirely. Worth prototyping after Phase 3 if Kanban feels stale.
3. **Bulk import retry strategy.** 429 lockout is 30 s — does the migration script back off linearly, exponentially, or just halt and ask? Decide before running the one-shot.
4. **Pre-warm KV after deploy?** Worker isolates start cold. First user of the day pays the cold-isolate penalty (KV miss → Airtable). Probably fine for 6 users; revisit if it bites.
