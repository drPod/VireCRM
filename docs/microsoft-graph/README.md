# Microsoft Graph (Outlook mail + calendars + subscriptions)

- **Snapshot:** 2026-05-22
- **Origin:** https://learn.microsoft.com/en-us/graph
- **Source library (context7):** `/microsoftgraph/microsoft-graph-docs-contrib`
- **Refresh:** `bash scripts/sync-microsoft-graph-docs.sh` (page pulls only). `reference.md` (context7 chunks) regenerated via `mcp__context7__query-docs` — see script TODO.

## Why this mirror exists

The CRM uses **per-agent MS Graph OAuth** for Outlook mail + calendar access (see `docs/decisions/05-outlook-integration.md`). Vendor docs are JS-rendered SPAs on `learn.microsoft.com` — every WebFetch costs latency + tokens and ties answers to network state. Mirror pins the doc set against a snapshot date so the Worker integration stays deterministic.

## Key concepts (memorize before touching MS Graph code)

- **Auth flow:** MS identity platform v2, **authorization-code with PKCE**, confidential client (CRM Worker holds `MS_GRAPH_CLIENT_SECRET`).
- **`offline_access` scope MANDATORY** for refresh tokens. Drop it → no refresh, hard fail at 1hr.
- **Required scopes:** `Mail.ReadWrite Mail.Send Calendars.ReadWrite User.Read MailboxSettings.Read offline_access`.
- **Refresh tokens:** 90-day **sliding** window (re-uses on each refresh). Not 60.
- **Mail webhook (change-notification) expiry:** ~70 hours / 2.94 days. NOT 7 days. Cron-renew every ~48h.
- **Webhook validation:** echo `validationToken` query param in plaintext within 10s of subscription create / renew.
- **Attachments:** ≤3 MB inline (`/messages/{id}/attachments` POST with bytes). ≥3 MB → `createUploadSession` + 4 MB chunked uploads, max 150 MB.
- **Throttle:** 4 concurrent + ≤10 req/sec per app+mailbox. Token-bucket on Worker side.
- **Tenant scope:** Outlook resources are per-user — work-or-school accounts only via `/users/{id}` or `/me`; consumer Outlook.com supported but feature subset differs.
- **Unsupported (sales must not promise):** on-prem Exchange (no Graph endpoint); Outlook Desktop local-only calendars not synced via Graph.

## When to consult what

| File | Size | Consult when |
|------|------|--------------|
| `reference.md` | 12K | First grep for code snippets — Python/Java/C# upload-session walkthroughs from official samples repo. |
| `auth-v2-user.md` | 128K | Wiring the auth-code+PKCE flow, token endpoint params, redirect URI rules, work/school vs consumer endpoint mux. |
| `auth-concepts.md` | 60K | Picking between delegated vs application permissions, understanding consent (admin vs user), tenant vs common endpoints. |
| `api-user-sendmail.md` | 128K | Implementing `POST /me/sendMail` — request body shape for `message` + `saveToSentItems`, recipients, attachments, internetMessageHeaders. |
| `api-user-list-messages.md` | 64K | Inbox sync — `GET /me/messages` with `$filter`/`$select`/`$top`/`$skip`/`$orderby`/delta query. |
| `webhooks.md` | 88K | Change-notification overview (concepts/lifecycle/resources). Subscribe → validate → receive → renew → delete. |
| `subscription-post-subscriptions.md` | 96K | The `POST /subscriptions` API — `changeType`, `notificationUrl`, `resource`, `expirationDateTime`, `clientState`, `latestSupportedTlsVersion`. |
| `api-user-list-events.md` | 128K | Calendar reads — `GET /me/events` filters, `Prefer: outlook.timezone` header, recurring-event expansion via `calendarView`. |
| `outlook-large-attachments.md` | 128K | Upload session for ≥3 MB attachments — slice into ≤4 MB chunks with `Content-Range`, handle `nextExpectedRanges`. |
| `throttling.md` | 56K | When `429 Too Many Requests` lands — `Retry-After` honour, per-service limits, evaluation periods, status-API guidance. |
| `permissions-reference.md` | 832K | Looking up the exact scope string for a specific endpoint. Largest file — open via search/grep, not full read. |

## Key API symbols / endpoints

- `POST /common/oauth2/v2.0/token` — token endpoint (use `organizations` or specific tenant id for work/school).
- `POST /me/sendMail` — send mail.
- `GET /me/messages` — list inbox; `$delta` for incremental sync.
- `POST /subscriptions` — create webhook.
- `PATCH /subscriptions/{id}` — renew (extend `expirationDateTime`).
- `DELETE /subscriptions/{id}` — unsubscribe.
- `GET /me/calendarView?startDateTime=...&endDateTime=...` — expanded recurring events in window.
- `POST /me/messages/{id}/attachments/createUploadSession` — large attachment.

## Maintenance

- Refresh the snapshot:
  ```bash
  bash scripts/sync-microsoft-graph-docs.sh
  ```
- Bump `_snapshot_date.txt` in the script when refreshing.
- `reference.md` requires manual `mcp__context7__query-docs` invocation — context7 isn't CLI-accessible. The script's header comment block documents the exact query to re-run.
- After refresh: spot-check `_urls.txt` for any new `FETCH FAILED` lines and update the page slug map if Microsoft Learn restructures URLs (the `webhooks` page already moved from `/webhooks` to `/change-notifications-overview` once).
