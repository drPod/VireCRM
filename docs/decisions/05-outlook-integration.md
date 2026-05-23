# 05 — Outlook integration approach

> **⚠ Agent-authored.** Drafted by AI agents from research + conversation context. Expect AI-pattern reasoning, **and expect baked-in assumptions** — agents make assumptions constantly (about scale, intent, prior art, constraints) and confidence does not equal correctness. Do not blindly follow this doc; verify load-bearing claims, assumptions included, before relying on them.

**Status:** vetted, decision upheld with edits
**Date:** 2026-05-22
**Decision owner:** Darsh

## Verdict

**KEEP Microsoft Graph direct.** The picked approach (per-agent OAuth, tokens in Supabase Vault, Worker handles refresh, Wrangler-stored client secret, two-way sync default-on, calendar push for renewals, threads auto-link to deal/customer) is the correct call for genesisxsx at customer #1 scale (~5–10 mailboxes). Vendors (Nylas, Unipile) add a per-seat tax that does not buy us anything we cannot build in days against the Graph SDK, and the CEO's specific pain points (Outlook Desktop, on-prem Exchange) are fundamentally **provider-side limits** that no aggregator can fix — they would just hide the failure mode behind a different API surface.

There are two concrete edits we should land in the planning docs:

1. **Replace the "tokens in Supabase encrypted" wording with "tokens in Supabase Vault" and pin the encryption tech (`vault.secrets` table backed by Authenticated Encryption with Associated Data via Supabase Vault).** "Encrypted in Supabase" is ambiguous; Vault is the named, supported, audited path. ([Supabase Vault docs](https://supabase.com/docs/guides/database/vault))
2. **Add explicit cron cadence + webhook-renewal cadence to TASKS Phase 5.** Refresh tokens are 90-day sliding (not 60-day as the brief stated) and mail-webhook subscriptions are 4,230 minutes ≈ 70 hours, not 7 days. Cron must run at minimum every ~2 days for webhooks, and refresh-on-use is enough for tokens (no cron needed for tokens themselves). ([Refresh tokens — Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens), [Subscription resource — Microsoft Learn](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0))
3. **Be explicit that "Outlook just works" === Microsoft 365 / Exchange Online only.** On-prem Exchange and Outlook Desktop's locally-cached calendar are out of scope, *by Microsoft Graph's design*, and no vendor changes that. Sales must not promise it.

## Decision

Microsoft Graph direct, per-agent delegated OAuth (authorization-code-with-PKCE on a confidential client), tokens in Supabase Vault, Worker holds `MS_GRAPH_CLIENT_SECRET` via `wrangler secret put`, refresh-on-use loop (no scheduled-refresh cron), mail subscription via webhook + delta-query reconciliation, calendar push via Graph events API for `Contract.endDate` renewals.

## Evidence

### 1. What MS Graph direct actually takes

**OAuth flow.** Microsoft identity platform v2 authorization-code grant against `/oauth2/v2.0/authorize` and `/oauth2/v2.0/token`. Confidential client (Worker holds `client_secret`). Required delegated scopes: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `offline_access` (to get a refresh token at all), `MailboxSettings.Read`. ([Get access on behalf of a user](https://learn.microsoft.com/en-us/graph/auth-v2-user))

**Token lifetimes.**
- Access token: random 60–90 min (75 min avg). ([Refresh tokens — Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens))
- Refresh token: **90-day sliding window** (the brief's "60-day" figure is wrong). Each use returns a fresh refresh token whose own 90-day clock starts fresh. So the only "silent expiry" mode is a 90-day idle account — easy to surface as "reconnect Outlook" prompt 14 days before idle expiry. ([Refresh tokens — Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens))
- **No** refresh token is issued for client-credentials grant; we are *not* using client credentials, we are using delegated user auth — so this distinction doesn't bite us, but it does mean we must keep `offline_access` in our scope list or the refresh token is silently absent. ([Refresh tokens — Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens))

**Change-notifications / webhooks.**
- Mail subscription max lifetime: **4,230 minutes (≈ 70.5 hours, ~2.94 days)**, not 7 days as informally cited. Some doc references for "rich notifications with payload" mention 7 days but the actual mail enforcement is the shorter value. Plan for renewal every ~48 hours to be safe. ([Microsoft Q&A — subscriptions expiring in 1 day](https://learn.microsoft.com/en-us/answers/questions/5525734/microsoft-graph-email-webhook-subscriptions-expiri), [Subscription resource — Microsoft Learn](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0))
- Webhook validation: Graph POSTs a `validationToken` to the `notificationUrl` and expects it echoed back within 10s. Worker handles this trivially. ([Receive change notifications through webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks))
- Delta query is the **complement** to webhooks: webhooks alert us, delta queries reconcile (so we don't lose mail if a webhook is dropped). Per-folder operation, `@odata.deltaLink` saved as state per mailbox per folder. ([Get incremental changes to messages — Microsoft Learn](https://learn.microsoft.com/en-us/graph/delta-query-messages))

**Throttling.**
- Per app+mailbox: **10,000 requests / 10 min** (~16 req/sec), **4 concurrent requests**, **150 MB upload / 5 min**. Microsoft recommends *designing* to 4–10 req/sec to stay clear of throttle. ([Microsoft Graph service-specific throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits))
- Per app+tenant: **130,000 requests / 10 sec** overall. ([Microsoft Graph service-specific throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits))
- For 5–10 mailboxes, we are nowhere near these limits.

**Attachments.**
- ≤ 3 MB: direct `POST .../attachments`. ([Attach large files to Outlook messages or events](https://learn.microsoft.com/en-us/graph/outlook-large-attachments))
- 3 MB – 150 MB: `createUploadSession` then chunked PUTs (≤ 4 MB per chunk). Resumable on network failure. ([attachment: createUploadSession](https://learn.microsoft.com/en-us/graph/api/attachment-createuploadsession?view=graph-rest-1.0))
- This is the **direct fix to the CEO's GHL pain #4** ("attachments over 3 MB break the sync"). GHL never bothered to wire up upload sessions; we do.

**Recurring events.** `GET /me/events` returns the seriesMaster only; concrete occurrences come from `GET /me/events/{id}/instances?startDateTime=&endDateTime=` or by using `calendarView` which expands instances in a range. Exceptions tracked separately from regular occurrences. ([Schedule recurring events](https://learn.microsoft.com/en-us/graph/outlook-schedule-recurring-events)) For our use case (push contract-end renewals to agent calendar) we do not need to *consume* recurrences; we *create* events with `null` recurrence patterns. Read-side recurrence only matters if we later show "free/busy" context — defer.

### 2. Build vs buy — vendor comparison

| Vendor | What you pay at v1 (5 mailboxes) | What they abstract | What they don't | Verdict |
|---|---|---|---|---|
| **Nylas v3** | Full Platform Email+Calendar: $15/mo includes first 5 connected accounts; +$1.50/account beyond. So 5 = **$15/mo flat**, 10 = **$22.50/mo**. ([Nylas pricing](https://www.nylas.com/pricing/)) | One API across Google + Microsoft + IMAP. Unified webhooks. Built-in dedupe + delta. Sandbox tier (5 accounts free). ([Nylas Sandbox docs](https://support.nylas.com/hc/en-us/articles/28841692494877)) | Cannot fix Microsoft-side limits (Outlook Desktop sync, on-prem Exchange, throttle ceilings). Adds latency hop. Migrating off later means rewriting our token + sync layer anyway. Attachments still 3 MB direct / 25 MB multipart / 10 MB instant-send — *worse than raw Graph's 150 MB*. ([Nylas attachments article](https://support.nylas.com/hc/en-us/articles/19492515408669)) | Skip. Their "freemium 5" tempts but the moment we hit 6 mailboxes we are paying $1.50/seat to wrap an SDK we already implemented. |
| **Unipile** | Tiered: up to 10 linked accounts = **€49/mo (~$55) base**, then €5/account/mo at 11–50, dropping. ([Unipile API pricing](https://www.unipile.com/pricing-api/)) | One API across Outlook + Gmail + IMAP + LinkedIn + WhatsApp + Slack DMs. Genuinely useful if we wanted LinkedIn/WhatsApp signal next to deal records. | Newer (~2024). Smaller community. Single point of failure. No on-prem Exchange. ([Unipile email-API comparison](https://www.unipile.com/email-api-providers/)) | Skip for now. Revisit if greenergiai asks for LinkedIn DM → deal threading. |
| **Pipedream** | Free 100 credits/day; $29/mo Basic (2k cr/day); $79/mo Advanced (10k cr/day). 1 credit = 30s of 256 MB workflow compute. ([Pipedream pricing breakdown](https://automationatlas.io/answers/pipedream-pricing-explained-2026/)) | Workflow builder. Pre-built Outlook trigger ("new email") + actions (send mail, create event). 1,000+ apps. ([Pipedream Outlook integrations](https://pipedream.com/apps/microsoft-outlook)) | Not an Outlook **API** — it's iPaaS glue. Token storage, webhook lifecycle, retry, idempotency all opaque. Designed for "Zapier-style" point integrations, not embedded SDK. | Wrong tool category. Skip. |
| **Raw IMAP/SMTP + iCal subscription** | $0 | True provider-independence. | No webhooks (IMAP IDLE is poll-based). No real read-receipts. No threading metadata. iCal calendar is **read-only** from the agent's view. ICS-feed renewals (write-once, no two-way edit) is what GHL effectively does and it's exactly the experience the CEO rejected. | Skip — this **is** the GHL pain. |
| **"Ship without Outlook in v1"** | $0 | Buys 2–3 wk of build time. | The CEO's *#2 pain point* on the original GHL teardown. Shipping a v1 without it is shipping a v1 that does not differentiate from her current pain. | Hard no. Phase 5, not phase ∞. |

**Break-even math:** Graph-direct build cost ≈ 2 engineering weeks for token loop + webhook + delta-sync + calendar push + reconnect-UX. At $200/hr blended × 80 hr = $16k one-time. Nylas at 10 seats = $22.50/mo = $270/yr. Break-even = **~60 years** before Nylas pays back. The "we save 2 weeks" pitch only works if we believe genesisxsx will pivot off Outlook within 60 years, which is absurd. The right reason to choose Nylas would be *multi-provider* (Gmail + Outlook + IMAP) at scale — and we are explicitly single-provider for customer #1.

### 3. Token storage — Supabase Vault is the right home

Options considered:

| Option | Encryption at rest | Multi-region read from CF Worker | RLS / per-user access | Verdict |
|---|---|---|---|---|
| **Supabase Vault** (chosen) | Authenticated encryption via libsodium under the hood; Key ID stored in DB, raw key outside SQL — even a full DB dump leaks only ciphertext + key IDs. Vault API stable; pgsodium internal-deprecation does not affect Vault. ([Supabase Vault docs](https://supabase.com/docs/guides/database/vault), [pgsodium status](https://supabase.com/docs/guides/database/extensions/pgsodium)) | Single region read — but Supabase has read-replicas if/when we need them. For 5–10 mailboxes the Worker → Supabase round-trip is ~50–100 ms, fine for refresh path (which is once per ~75 min per mailbox anyway). | Yes — RLS on the `vault.decrypted_secrets` view per-agent. | **Use this.** |
| Cloudflare KV | AES-256 at rest at the platform layer, but **not application-level encrypted by default** — you store ciphertext yourself or you trust CF's at-rest only. KV docs say apps are "responsible for app-level encryption" for sensitive data. ([Cloudflare KV data security](https://developers.cloudflare.com/kv/reference/data-security/)) Eventually-consistent (up to 60s propagation) — bad for a token-rotation race. | Multi-region native, ~ms latency. | No per-row ACL; you encode tenancy in keys. | Skip. App-side AEAD on top of KV = reinventing Vault badly. Eventual consistency is the killer. |
| Cloudflare D1 | At-rest encryption per CF platform default. SQL access. | Regional primary + read replicas in beta. | Manual; no built-in row-level security. | Defensible but we'd have to roll our own column-encryption. Vault gives us this for free. |
| Cloudflare Durable Objects | At-rest encryption per CF platform default. Single-writer strong consistency per object — *good* for token rotation atomicity. | Each DO is pinned to a region. | Tenant boundary natural (one DO per agent). | Defensible and arguably nicer than Supabase for the **rotation race condition**, but it puts auth state outside Supabase, which means our user identity lives in two places. Not worth the split. |
| **Cloudflare Secrets Store** | AES-256 + TLS 1.3. Two-level KEK/DEK key hierarchy. ([Secrets Store beta](https://blog.cloudflare.com/secrets-store-beta/)) | Multi-region. | Account-level, not per-user. | Wrong granularity — Secrets Store is for *our* secrets (the MS Graph client secret), not for *each agent's* refresh token. Use it for `MS_GRAPH_CLIENT_SECRET` (which is what `wrangler secret put` does today; consider migrating that one secret to Secrets Store later). |

**Net:** `MS_GRAPH_CLIENT_SECRET` → Wrangler secret (today) → migrate to CF Secrets Store later. Per-agent OAuth refresh tokens → Supabase Vault. Two different secret types, two different homes.

### 4. OAuth refresh in Worker — refresh-on-use, not cron

The brief asked: cron daily / hourly / per-request? Answer: **per-request, lazy** is correct.

- Access tokens expire ~75 min. Refresh on the first request after expiry.
- Refresh tokens replace themselves on every use and reset the 90-day clock. So as long as a mailbox is used **once every 90 days**, no expiry. Customers using the CRM weekly will have effectively perpetual tokens.
- The only cron we need is the **subscription-renewal cron** (every ~48 hours, renew Graph webhooks). That's a **separate** Worker cron trigger, not a token-refresh cron. Cron Triggers natively supported on Workers, run from the `scheduled()` handler, billed pennies. ([Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/))
- Race-condition hardening: two concurrent Worker invocations both trying to refresh a soon-expired token = lost refresh. Use a **single-flight lock per refresh** (Durable Object lock keyed by agent ID, or `SELECT ... FOR UPDATE` in Postgres). Cloudflare's own `workers-oauth-provider` uses a **sliding-window pattern: two refresh tokens valid at once**, so a transient client failure can retry with the previous token. We mirror that pattern. ([cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider))

**Reconnect-UX flow:** Worker tracks `refresh_token_issued_at`. Daily cron flags any agent whose token is >75 days old → toast banner "Reconnect Outlook to keep email syncing." Click → re-runs OAuth. Solves GHL pain #5 ("tokens silently expire").

### 5. GHL pain-point coverage matrix

| GHL pain | Graph direct | Nylas | Unipile |
|---|---|---|---|
| (a) Outlook Desktop events don't sync (cloud-only) | **Cannot fix** — Microsoft Graph reads Exchange Online mailboxes, not the local OST/PST. New Outlook is cloud-only by Microsoft's own design. ([Outlook calendar API overview](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview)) | Same — Nylas reads via Graph. | Same. |
| (b) On-prem Exchange unsupported | **Cannot fix** for the same reason. *Scope it out in the README.* | Nylas supports legacy EWS in some plans but it's deprecated; effectively also no. | No. |
| (c) Labs toggle off-by-default | **Fixed** — connection IS sync. No toggle. | Same. | Same. |
| (d) Attachments >3 MB break | **Fixed** — implement `createUploadSession` for 3–150 MB. ([Attach large files](https://learn.microsoft.com/en-us/graph/outlook-large-attachments)) | Partial — Nylas caps at 25 MB multipart, 10 MB instant-send. *Worse than Graph direct.* ([Nylas large-attachment article](https://support.nylas.com/hc/en-us/articles/19492515408669)) | Similar to Nylas. |
| (e) Tokens silently expire | **Fixed** — Worker tracks `issued_at`, surfaces 14-day reconnect warning. | Nylas handles invisibly; their UI for re-auth is *their* UI, not ours. | Same. |
| (f) Event-type calendars don't support Outlook | **Fixed** — we build the calendar feed ourselves via Graph events API. | Same. | Same. |

Result: **3 of 6 pains are uniquely fixable by anyone using Microsoft Graph**, and Graph direct fixes them better than the vendors (specifically attachments). The other 3 are physically unfixable by anyone — those need to be *scoped out in user expectations*, not fixed.

### 6. Customer #1 specifics

5–10 mailboxes. Single customer in v1. CEO + handful of agents.

- Nylas at scale-out (50 customers × 5 agents = 250 seats): $5.50 × 250 = $1,375/mo = $16.5k/yr. Now Graph-direct pays back in ~12 months on a single mid-size customer cohort, and stays paid-back forever.
- Unipile at same scale: similar order of magnitude (~$1.1k/mo).
- Graph-direct: $0/mo provider fee, marginal ~1–2 days/yr maintenance.

Even better: **the Worker module that wraps Graph is the same module a future Gmail / IMAP / Aurinko provider would slot into.** We're not paying for "provider portability" we don't need.

## Alternatives (one-line each, see Evidence §2 for full)

- **Nylas v3** — skip; per-seat tax, worse attachments, no actual Outlook-pain fix.
- **Unipile** — skip; revisit only if/when we want LinkedIn/WhatsApp inside deal records.
- **Pipedream** — wrong tool category (iPaaS, not SDK).
- **Raw IMAP/SMTP + iCal** — this IS the GHL pain.
- **Ship without Outlook in v1** — hard no; the CEO's #2 pain.

## Proposed edits

### `README.md`

**Lines 24, 77–79** → tighten and add provider-side caveat. Replace:

> - **Outlook that works on day one.** Two-way sync default-on. Office 365 + Exchange Online. No buried Labs toggles, no silent token expiry without prompts to reconnect.

with:

> - **Outlook that works on day one (Microsoft 365 / Exchange Online only).** Two-way email + calendar sync, default-on. No Labs toggle, no silent token expiry — we surface a 14-day "reconnect Outlook" prompt before any token can lapse. Attachments up to 150 MB via Graph upload sessions (not the 3 MB ceiling GHL hits). On-prem Exchange and Outlook Desktop's locally-cached calendar are out of scope — these are limits of Microsoft Graph itself, not us, and no integration vendor changes that.

Replace lines 77–79 (the `## Outlook integration` section, currently three lines that just say "The CEO wants email tied to deals. Build an **Outlook integration** for her!") with:

> ## Outlook integration
>
> Built on Microsoft Graph (Microsoft 365 / Exchange Online tenants only). Per-agent OAuth via the Microsoft identity platform v2 authorization-code grant; the Worker holds the confidential-client secret. Each agent's refresh token lives in Supabase Vault, encrypted with libsodium AEAD. Refresh tokens are 90-day sliding — used at least once every 90 days they renew indefinitely; the Worker surfaces a 14-day "reconnect Outlook" banner before any token can lapse.
>
> Inbound mail comes through Microsoft Graph change-notification webhooks (renewed every ~48 hours by a Worker cron, since mail subscriptions cap at ~70 hours per Microsoft's actual enforcement). Delta queries reconcile state per folder per mailbox so we don't lose mail if a webhook drops. Inbound threads auto-link to deal + customer records via sender-email matching against `Customers.Primary Email` and `Customers → Contacts`.
>
> Outbound send-from-CRM uses `POST /me/sendMail`. Calendar push for contract-end renewals writes events directly to the agent's primary calendar via `POST /me/events`. Attachments between 3 MB and 150 MB use `createUploadSession` with 4 MB chunks — this is the specific fix to the GHL pain point where >3 MB attachments silently break.
>
> Vendors evaluated and rejected: Nylas (per-seat tax of ~$1.50/mailbox/mo on top of $15 base, plus *worse* attachment ceilings of 10–25 MB), Unipile (~$5/seat/mo, newer, valuable later if we want LinkedIn/WhatsApp threading), Pipedream (wrong tool category — iPaaS, not SDK). See `docs/decisions/05-outlook-integration.md` for the full vendor matrix and the break-even math.

### `CLAUDE.md`

**Lines 75–82** (the "Secrets locations" section) → add Outlook-specific line. After:

```
- Wrangler secrets: `AIRTABLE_PAT`, `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `MS_GRAPH_CLIENT_SECRET`.
```

append:

```
- Outlook OAuth tokens: per-agent refresh tokens in Supabase Vault (`vault.secrets`), never in Wrangler. Wrangler holds only the app-level `MS_GRAPH_CLIENT_SECRET`.
- Outlook scope set: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `MailboxSettings.Read`, `offline_access`. Drop `offline_access` = no refresh token issued, hard fail.
```

### `TASKS.md`

**Lines 76–84** (Phase 5 block) → replace with caveman-tight version:

```
## Phase 5 — Outlook integration `[stated]`

- [ ] **MS Graph app reg.** Azure portal. Confidential client. Redirect = `https://greenenergiai.virecrm.com/oauth/microsoft/callback`. Scopes: `Mail.ReadWrite Mail.Send Calendars.ReadWrite User.Read MailboxSettings.Read offline_access`. Drop `offline_access` = no refresh token, hard fail.
- [ ] **OAuth flow.** Worker handles `/oauth/microsoft/start` + `/callback`. Auth code → exchange for access+refresh. Persist refresh token + `issued_at` to Supabase Vault per agent.
- [ ] **Token refresh — refresh-on-use, not cron.** Wrap every Graph call in `getValidToken(agentId)`. If <5 min to expiry, refresh, persist new refresh token (sliding window). Single-flight lock per agent to avoid concurrent-refresh race (Durable Object, or `SELECT FOR UPDATE`).
- [ ] **Webhook subs.** Subscribe to `/me/mailFolders/inbox/messages` per agent on connect. Lifetime ≈ 70 h (mail cap, not the documented 7-day generic). Cron every 48 h re-PATCHes the subscription `expirationDateTime`. ([subscription resource](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0))
- [ ] **Validation token handshake.** Worker echoes `validationToken` ≤ 10 s on subscribe + on renewal. 200 OK only.
- [ ] **Delta-query reconciliation.** Per agent, per folder. Persist `@odata.deltaLink`. Run on connect, on webhook miss, daily cron. Catches mail dropped between webhook lapses.
- [ ] **Inbound auto-link.** Match `from.emailAddress.address` ↔ Airtable `Customers.Primary Email` (and Contacts). Link message → deal/customer record. Drop unmatched mail into "unlinked" bucket.
- [ ] **Outbound send.** Compose in deal view → `POST /me/sendMail`. Attachments ≤ 3 MB inline; 3–150 MB via `createUploadSession` + 4 MB PUT chunks.
- [ ] **Calendar push.** Contract.endDate − 90 days → `POST /me/events` on owner agent's primary calendar. Idempotent: store `graphEventId` on contract row, re-PATCH if endDate changes.
- [ ] **Reconnect UX.** `refresh_token_issued_at` > 75 days → toast "Reconnect Outlook." Click → re-run OAuth start. Solves silent-expiry pain.
- [ ] **Throttling guard.** Cap Worker to 4 concurrent + ≤ 10 req/sec per app+mailbox. Exponential backoff on 429 with `Retry-After`. ([throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits))
- [ ] **Scope out in copy.** On-prem Exchange + Outlook Desktop local calendar = unsupported by Graph itself. README + sales convo must say so.
```

### `HANDOFF.md`

**Lines 55–58** → expand the Outlook blocker:

```
- **Microsoft Graph app registration not done** (for Outlook). Defer until Phase 5 — don't block earlier work. App reg location: Azure portal (entra.microsoft.com → App registrations). Need: tenant type (multi-tenant — agents may not all be in greenergiai's AAD tenant; confirm with CEO), redirect URI `https://greenenergiai.virecrm.com/oauth/microsoft/callback`, `MS_GRAPH_CLIENT_SECRET` via `wrangler secret put`. See `docs/decisions/05-outlook-integration.md`.
```

### `AGENTS.md`

If the file routes agents to per-area docs, add a line under integrations:

```
- Outlook integration: see `docs/decisions/05-outlook-integration.md` before touching Graph code. Token lifetimes + webhook cadence + throttling caps captured there.
```

(Skip if `AGENTS.md` doesn't have an integrations section yet — we'll add it when the integration code lands.)

## Open questions

1. **AAD tenancy.** Does greenergiai have its own Microsoft 365 tenant, or are agents on separate personal/business Microsoft accounts? Determines whether we register a **multi-tenant** Azure app (admin consent likely needed per-tenant) or a single-tenant one (simpler, agents only in greenergiai's tenant). Confirm with CEO before Azure app reg.
2. **Calendar selection.** Push to agent's *primary* calendar or a CRM-owned subcalendar named "greenergiai renewals"? Subcalendar is cleaner (agent can hide it) but adds a setup step. Default: primary calendar with a recognizable event prefix (`[greenergiai] Renewal: <customer>`). Confirm.
3. **Shared mailbox semantics.** If a customer is contacted from a shared inbox (e.g. `sales@greenergiai.com`), do we auto-link based on shared mailbox or only the agent's personal address? Affects scope (add `Mail.Read.Shared` later if so).
4. **Migration trigger.** When (or whether) to move `MS_GRAPH_CLIENT_SECRET` from `wrangler secret` to CF Secrets Store. Defer until we have ≥ 2 Workers sharing the secret. Today: single Worker, Wrangler secret is fine.
