

## Goal

Make the **Connect** buttons on Gmail and Google Calendar in Settings → Integrations actually launch a real Google OAuth sign-in popup, instead of just flipping an "enabled" flag and waiting for someone to magically link credentials.

## Why this is needed

Today the Connect button on Gmail / Google Calendar:
1. Calls `enableConnectorFn` → writes `enabled = true` to `org_connectors`.
2. Checks if `GMAIL_API_KEY` / `GOOGLE_CALENDAR_API_KEY` already exists in the runtime env.
3. If not (the normal case for end-users), shows **"Awaiting auth"** with no way forward.

There is no actual OAuth pop-up. The Lovable Connector Gateway holds Google tokens, but nothing in the app asks the user to sign in with Google.

## What you'll see after this change

```text
Settings → Integrations → Gmail card
   [ Connect Gmail ]      ← click
       │
       ▼
   Google sign-in popup opens (accounts.google.com)
   • Pick the Google account you want to send from
   • Approve "Send email on your behalf" + "See your email address"
       │
       ▼
   Popup closes, card flips to:
       Connected ✓   you@gmail.com
       [ Send test email ]  [ Test ]  [ Edit ]  [ Disconnect ]
```

Same flow for **Google Calendar** (scopes: read/write events on calendars you own).

If the user is **not the workspace owner**, the card still shows "Ask your owner to connect this" — owner-only restriction is unchanged.

## How it works (technical)

### 1. Wire the existing `Connect` button to the managed OAuth flow

Lovable already provides a managed OAuth broker at `/~oauth/initiate` for the connectors in our catalog. Replace the current `handleEnable` for Google providers in `src/components/crm/ConnectorIntegrations.tsx`:

- For `gmail` and `google_calendar`, opening `Connect` does:
  1. POST to a new server fn `startConnectorOAuthFn({ provider })` which returns an authorization URL built against `https://oauth.lovable.app/initiate?connector_id=gmail&org_id=…&return_to=…`.
  2. Open that URL in a centered popup window (`window.open(url, "lovable-oauth", "width=520,height=720")`).
  3. Poll `listConnectorsFn` every 2s for up to 90s. When the gateway reports `credentialPresent && verified`, close the popup and flip the card to **Connected**.
- Other connectors (Slack, HubSpot, etc.) keep the existing flow.

### 2. New server function — `startConnectorOAuthFn`

In `src/functions/connectors.functions.ts`. Owner-only. Inputs: `organizationId`, `provider`. Returns:

```ts
{ authorizeUrl: string }
```

Builds the URL using:
- `LOVABLE_API_KEY` (already in secrets) for broker auth header preflight,
- `connectorId` from the catalog,
- `state` = signed JWT containing `{ orgId, provider, nonce, exp }` so the callback can be validated,
- `redirect_uri` = `${publicAppUrl}/integrations/oauth/callback`.

### 3. New callback route — `/integrations/oauth/callback`

`src/routes/integrations.oauth.callback.tsx` — minimal page that:
- Reads `?status=success|error&provider=…` from the broker redirect,
- Posts a `window.opener.postMessage({ type: "lovable-oauth", provider, ok })` then `window.close()`,
- If opened directly (no opener), shows a friendly "You can close this tab" screen.

The parent (Settings page) listens for that `postMessage` to short-circuit polling.

### 4. New server function — `recordOAuthCallbackFn` (exchange + persist)

POST endpoint hit by the broker (or by the callback route after the broker redirects back). Validates the `state` JWT, asks the gateway `/api/v1/connections` for the freshly created connection, and:
- Upserts `org_connectors { provider, enabled: true, config: { connectedAccount: <email> } }`.
- Stores the connected account email in `config.connectedEmail` so the card can display "Connected as you@gmail.com".
- Pre-fills `config.fromAddress` (Gmail) or `config.timeZone` (Calendar) with sane defaults.

### 5. Status enrichment

Update `ConnectorStatus` returned by `listConnectorsFn` to include:

```ts
connectedEmail?: string | null
```

So the UI can show "Connected as <email>" under each Google card. Pulled from `org_connectors.config.connectedEmail`.

### 6. Disconnect

`disableConnectorFn` already exists. Extend it for Google providers to also call the gateway's `DELETE /api/v1/connections/{id}` so revoking in our app actually revokes the token in Google. If the gateway call fails (e.g. token already expired), still flip `enabled = false` locally and toast a soft warning.

### 7. UX polish on the cards (Gmail / Calendar only)

- Replace the generic "Connect" button with **"Connect Gmail"** / **"Connect Google Calendar"** with the Google "G" mark on the left.
- After connection, show **Connected as you@gmail.com** under the title.
- A subtitle line: *"We'll only ask for permission to send email and read the address you're sending as. You can revoke access in your Google account at any time → myaccount.google.com/permissions"*.
- A small **"Send test email"** button on the Gmail card that fires `sendGmailFn` to the connected address itself, so users can verify in one click without opening a lead.

## OAuth scopes requested

| Provider | Scopes |
|---|---|
| Gmail | `gmail.send`, `userinfo.email` |
| Google Calendar | `calendar.events`, `userinfo.email` |

These are the minimum needed for the existing `sendGmailFn` and `scheduleGoogleCalendarEventFn` handlers.

## DB changes

None required. `org_connectors.config` (jsonb) already stores arbitrary keys — `connectedEmail` slots in alongside `fromAddress`, `timeZone`, etc.

## Out of scope

- Per-user (vs per-org) Gmail accounts — still one shared connection per org.
- Google Workspace domain-wide delegation.
- Refresh-token rotation handling (gateway does this).
- Inbound Gmail / Calendar sync.

