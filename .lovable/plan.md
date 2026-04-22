

## Goal

Make Gmail, Google Calendar, Twilio, and SendGrid first-class integrations users can link from Settings → Integrations and use directly from a lead.

## Current state

- **Twilio** — already live (Connect/Test/Edit/Disconnect + `sendTwilioSmsFn`). No work needed.
- **Gmail** — in catalog as `beta` (enable-only). No send action.
- **Google Calendar** — in catalog as `beta` (enable-only). No scheduling action.
- **SendGrid** — not present at all. Not available as a Lovable Connector → must be a BYO API-key provider, like Apollo / Hunter / Snov.

## What you'll see

```text
Settings → Integrations
─────────────────────────────────────────────
[ One-click integrations ]
  Email & Calendar
   ┌─ Gmail ───────────────── Connected ─┐
   │ Send-from address: you@company.com  │
   │ [ Send test email ] [ Test ] [ Edit ] [ Disconnect ]
   └─────────────────────────────────────┘
   ┌─ Google Calendar ─────── Connected ─┐
   │ Default meeting length: 30 min      │
   │ Time zone: America/Chicago          │
   │ [ Test ] [ Edit ] [ Disconnect ]    │
   └─────────────────────────────────────┘
   ┌─ Microsoft Outlook ─── (existing)   │

  Communication
   ┌─ Twilio SMS ─────────── (existing) ─┐

[ Lead-source & email API keys ]
   ┌─ SendGrid ──────────── Connected ───┐
   │ Key: SG.x••••a1f2                   │
   │ Verified just now                   │
   │ [ Test ] [ Edit ] [ Disconnect ]    │
   └─────────────────────────────────────┘
```

On a lead drawer:
- "Send email" now offers **Gmail / Outlook / SendGrid** (whichever are connected).
- "Schedule meeting" now opens a small dialog (date, time, duration, invite the lead's email) and creates a Google Calendar event.

## What gets built

### 1. Catalog updates (`src/lib/connectors/catalog.ts`)

- **Gmail** → `status: "live"`, add `configFields: [{ key: "fromAddress", label: "Send from address", placeholder: "you@gmail.com" }]`, description tightened to "Send outreach emails from your Gmail account."
- **Google Calendar** → `status: "live"`, add `configFields`:
  - `defaultDurationMinutes` (default 30)
  - `timeZone` (default "UTC", helper text suggests browser TZ)
  - `defaultCalendarId` (optional, default "primary")
- No catalog change for SendGrid (it lives in the BYO section, not the connector catalog).

### 2. New connector action handlers (`src/functions/connector-actions.functions.ts`)

- **`sendGmailFn`** — POST to `/gmail/v1/users/me/messages/send` with a base64url-encoded RFC 2822 message (`From`, `To`, `Subject`, `Content-Type: text/html`, body). Logs to `connector_activity_log` like the Outlook handler.
- **`scheduleGoogleCalendarEventFn`** — POST to `/calendar/v3/calendars/{calendarId}/events` with `summary`, `description`, `start.dateTime`, `end.dateTime`, `timeZone`, `attendees: [{ email }]`, `sendUpdates=all` so the lead gets the invite email. Returns the new event's `htmlLink`.

Both follow the existing `assertMemberAndConnector` → `callGateway` → `recordConnectorActivity` pattern.

### 3. SendGrid as a BYO provider

SendGrid is not a Lovable Connector. It joins the existing BYO flow used by Apollo/Hunter/Snov.

- **`src/lib/sendgrid.ts`** — small client:
  - `verifySendgridKey(key)` → `GET https://api.sendgrid.com/v3/scopes` with `Authorization: Bearer <key>`. 200 = ok; 401 = "Invalid SendGrid API key"; otherwise pass through error.
  - `sendSendgridEmail({ key, from, to, subject, html })` → `POST https://api.sendgrid.com/v3/mail/send`.
- **`src/functions/integrations.functions.ts`**:
  - Extend `SUPPORTED_PROVIDERS` to include `"sendgrid"` and route it through `verifySendgridKey` in `verifyKey()`. Existing get/save/test/delete server fns automatically gain SendGrid support — no new fns needed.
- **`src/functions/connector-actions.functions.ts`**:
  - `sendSendgridEmailFn` — looks up the org's stored SendGrid key from `org_integrations`, calls `sendSendgridEmail`, logs activity. Requires a "from address" passed in (or stored on the integration row's existing column — see Edit UI below).
- **`src/components/crm/IntegrationsSettings.tsx`** — add a `ProviderConfig` row for SendGrid:
  - Setup steps: 1) Sign in to SendGrid, 2) Settings → API Keys → Create API Key (Full Access or Mail Send), 3) Verify a sender domain or single sender, 4) Paste key here.
  - Single field input (`SG.…`).
  - Config field (stored alongside the masked key UI as part of the Edit panel) for `defaultFromAddress`.

### 4. Lead drawer wiring (`src/components/crm/LeadConnectorActions.tsx`)

- **Send email**: detect which of `gmail`, `microsoft_outlook`, `sendgrid` are connected. Show a dropdown to pick provider, then the existing email composer. Submit calls the matching server fn.
- **Schedule meeting** (new button, only shown if `google_calendar` is connected):
  - Small dialog: date, start time, duration (prefilled from config), notes.
  - Calls `scheduleGoogleCalendarEventFn` with the lead's email as attendee.
  - On success: toast with "Open in Calendar" link.

### 5. Quiet fix

Address the runtime "Cannot convert object to primitive value" error surfaced in the preview while doing the catalog/UI edits.

## Out of scope

- Inbound sync (Gmail thread pulls, Calendar busy/free reads).
- SendGrid templates / dynamic data.
- Per-user (vs per-org) Gmail accounts.

## DB changes

None. Gmail/Calendar config goes in `org_connectors.config` (already jsonb). SendGrid uses the existing `org_integrations` table; the `defaultFromAddress` is stored in a small jsonb column the row already has, or — if not — in a new nullable `config jsonb` column added via migration during implementation.

