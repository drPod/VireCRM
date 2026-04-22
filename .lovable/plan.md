

## Goal

Turn the existing Settings → Integrations tab into a complete management page where you can **Add, Edit, Test, and Disconnect** every CRM integration — both BYO API-key providers (Apollo, Hunter, Snov) and one-click connectors (Slack, Outlook, Teams, Twilio, HubSpot, Linear, etc.).

## What's missing today

| Integration type | Add | Edit | Test | Disconnect |
|---|---|---|---|---|
| BYO (Apollo/Hunter/Snov) | yes | **no** (must remove first) | **no** | yes |
| Connectors (Slack/HubSpot/…) | partial (no real OAuth trigger) | **no** (config like default Slack channel can't be changed) | **no** (only auto-verify on load) | yes |

We'll close every "no" above and unify the look so each card has the same four actions.

## What you'll see

```text
Settings → Integrations
────────────────────────────────────────────
[ Monthly Lead Credits card — unchanged    ]

[ One-click integrations  (Slack, Outlook, …) ]
  ┌─ Slack ───────────────── Connected ───┐
  │  Default channel: #sales              │
  │  Verified 2m ago                      │
  │  [ Test ]  [ Edit ]  [ Disconnect ]   │
  └───────────────────────────────────────┘

[ Lead-source API keys  (Apollo, Hunter, Snov) ]
  ┌─ Apollo.io ────────────── Connected ──┐
  │  Key: apol••••a91f                    │
  │  Verified yesterday                   │
  │  [ Test ]  [ Edit ]  [ Disconnect ]   │
  └───────────────────────────────────────┘
```

Every card now exposes the same four primary actions. "Edit" opens a small inline editor (new key / new config); "Test" pings the provider live and shows a success or error toast; "Disconnect" asks for confirmation before removing.

## Per-action behaviour

- **Add (Connect)**
  - BYO: paste key → server verifies live with the provider → saved (existing flow, kept as-is).
  - Connector: button now actually triggers the Lovable Connector OAuth flow for the provider (today it just marks the row enabled). After the popup closes we re-verify.

- **Edit**
  - BYO: "Edit" reveals the password input pre-filled empty; entering a new key replaces the old one (re-verified before saving).
  - Connector: opens a small form for that connector's config — e.g. Slack default channel, Outlook from-address, Twilio from-number, HubSpot import limit. Saved via the existing `updateConnectorConfigFn`.

- **Test**
  - BYO: server hits the same lightweight verify endpoint used at save time (`/auth/health` for Apollo, `/v2/account` for Hunter, OAuth token for Snov) and updates `last_verified_at`.
  - Connector: calls the gateway's `/api/v1/verify_credentials` endpoint and refreshes the badge/error.
  - Either way the result shows as a toast plus a "Verified just now" / "Failed: …" line on the card.

- **Disconnect**
  - BYO: existing delete flow, with a clearer confirm dialog ("This will stop Auto-Find Leads via Apollo…").
  - Connector: existing disable + (new) call the disconnect helper so the gateway connection is cleanly released, not just marked `enabled=false`.

## Technical changes

1. **New server functions**
   - `testIntegrationFn` (BYO) — re-runs `verifyApolloKey` / `verifyHunterKey` / `verifySnovKey` against the stored key and updates `last_verified_at`.
   - `testConnectorFn` (connector) — wraps `verifyConnectorCredentials` so the UI can trigger it on demand instead of only at list time.
   - `updateIntegrationKeyFn` (BYO) — same as save, but explicit "edit" semantics (verify → upsert → return new masked key).

2. **Refactor `IntegrationsSettings.tsx`**
   - `ProviderCard` gains `Test` + `Edit` buttons and an inline edit panel.
   - Status badge becomes "Connected · Verified 5m ago" or "Failed verification" with the provider's error.

3. **Refactor `ConnectorIntegrations.tsx` → `ConnectorRow`**
   - Adds `Test` and `Edit` buttons (Edit opens a per-connector config drawer).
   - Connect button now calls a small client helper that opens the Lovable Connector OAuth flow for `meta.connectorId`, then calls `enableConnectorFn` on success.
   - Per-connector config schemas (Slack: `defaultChannel`; Outlook: `fromAddress`; Twilio: `fromNumber`; HubSpot: `importLimit`; others: none) drive what the Edit form renders.

4. **No DB migrations** — `org_integrations` and `org_connectors` already store everything we need (`api_key`, `last_verified_at`, `config jsonb`, `enabled`).

5. **Owner-only guard** is unchanged — every new server function calls `assertOwner` first.

## Out of scope

- Adding more providers beyond what's already in the catalog.
- Per-user (vs per-org) connections.
- Two-way sync schedules — this PR is just settings management.

