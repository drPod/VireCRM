
## Critical issues found

- Sign-in is fragile: auth state, profile/role loading, and subscription gating are split across `login.tsx`, `AuthProvider.tsx`, `_app.tsx`, and `useSubscription.ts`, so a successful login can still feel broken.
- Auth data loading assumes perfect single-row data (`.single()` calls for profile/role/org) and does not fail gracefully.
- Several CRM areas are only partially operational:
  - Workflows can be created/edited but there is no execution path in the codebase.
  - Campaigns can be created, but lifecycle controls are minimal and analytics are partly inferred rather than truly attributed.
  - Email Marketing, Calendar, and Reputation contain “coming soon”/placeholder guidance that should not be exposed at launch.
- Some server functions still return raw thrown errors or rely on inconsistent response shapes.
- Platform admin visibility is gated by a hardcoded email list in the UI instead of backend-backed config.
- Multiple pages rely on optimistic assumptions without a launch-grade fallback path.

## Implementation plan

### 1) Fix sign-in/sign-up/auth first
- Stabilize `AuthProvider` so profile, role, and organization fetches are resilient and do not silently leave the app in a broken post-login state.
- Make login redirect deterministic:
  - successful password login -> authenticated app route
  - confirmed but unsubscribed user -> billing with a clear reason
  - unconfirmed user -> confirm-email flow
- Remove race conditions between `login.tsx`, `_app.tsx`, and `useSubscription.ts`.
- Unify post-auth navigation for password login, Google login, signup, invite acceptance, and reset-password completion.
- Add safe handling for missing role/org rows so users do not get trapped behind a blank loading shell.

### 2) Harden the launch-critical server functions
- Review and normalize all CRM server functions so they either:
  - return typed safe payloads for recoverable failures, or
  - throw clear user-facing errors for non-recoverable failures.
- Apply the same hardening pattern across:
  - `ai-advisor.functions.ts`
  - `find-leads.functions.ts`
  - `auto-outreach.functions.ts`
  - `outreach-preview.functions.ts`
  - `command.functions.ts`
  - `complete-task.functions.ts`
  - `email-log.functions.ts`
  - `support-ticket.functions.ts`
- Remove any remaining raw `Response`-style failures that can surface as `[object Response]` in the UI.

### 3) Make Leads + Pipeline fully operable
- Ensure all lead actions are fully wired and refresh the UI correctly:
  - create lead
  - import leads
  - AI find leads
  - edit lead
  - delete lead
  - send outreach
  - activity timeline refresh
  - email log refresh
- Make pipeline cards open the lead drawer consistently and keep drag/drop status changes synced with lead details.
- Keep HTML-stripped previews consistent between Activity and Emails tabs.
- Add inline error states where data loads can fail, instead of silent empty states.

### 4) Make Clients + Billing + Payouts production-safe
- Audit and harden:
  - create client account
  - auto-email credentials
  - reset client password
  - reseller plans CRUD
  - client signup link copy
  - payout mark-paid flow
  - CSV exports
  - manual subscription/admin flows
- Move platform-admin gating away from the hardcoded UI list and align it with backend configuration.
- Ensure client creation and password reset always leave the operator with a usable fallback if email delivery fails.

### 5) Make Campaigns + Email Marketing operable
- Upgrade Campaigns from “create and view only” into a usable lifecycle:
  - edit campaign
  - pause/resume
  - delete
  - refresh counts after changes
- Remove or replace any launch-time placeholder content in Email Marketing.
- Stop showing functionality that is not actually implemented.
- Ensure campaign analytics only shows metrics the system can truly support; where attribution is not real, either implement proper attribution or remove the misleading metric.

### 6) Make Workflows honest and operable
- Resolve the biggest gap in the CRM:
  - either implement a minimal execution engine for the currently supported triggers/actions
  - or temporarily ship workflows as a draft builder only and disable “active” behavior until execution exists
- For launch readiness, the safer path is:
  - keep create/edit/save/delete working
  - disable misleading “active/enrolled/completed/last run” behavior unless backed by real execution
  - remove false runtime signals from the list page
- If execution is implemented in this pass, support only the current defined nodes:
  - triggers: lead created, status changed, message received
  - actions: send email, add tag, wait, branch

### 7) Clean Settings + Team + White-label
- Ensure Team management is fully operational end-to-end:
  - invite
  - copy invite link
  - cancel invite
  - change role
  - remove member
- Ensure White-label settings save and refresh reliably:
  - brand name
  - color
  - logo
  - custom domain
  - support email
  - reseller toggle
- Harden Email Audit Log to use the same defensive normalization/error handling as lead email logs.

### 8) Remove launch-risk UI
- Strip or hide any UI that implies a working feature when the backend/runtime path is missing.
- Priority removals/hardening:
  - “coming soon” launch blockers in Email Marketing / Calendar / Reputation
  - misleading workflow runtime controls if no executor is implemented
  - any dead or placeholder CTA in CRM routes

### 9) Deep QA pass before release
- Run a full end-to-end launch checklist in this order:
  1. Sign up
  2. Confirm email
  3. Sign in
  4. Reset password
  5. Billing access / unsubscribed gating
  6. Leads CRUD
  7. Outreach preview + send
  8. Activity / Emails tabs
  9. Pipeline drag/drop
  10. Team invites / role changes
  11. White-label save flow
  12. Clients create / reset password
  13. Campaign create/edit/pause/delete
  14. Email Marketing route
  15. Workflow create/edit/save/delete
  16. Payouts / expenses / invoices / revenue / analytics
- Check console/runtime errors after each area and fix any hidden failures before moving on.

## Technical details

- Primary auth files:
  - `src/components/auth/AuthProvider.tsx`
  - `src/routes/login.tsx`
  - `src/routes/signup.tsx`
  - `src/routes/reset-password.tsx`
  - `src/routes/confirm-email.tsx`
  - `src/routes/_app.tsx`
  - `src/hooks/useSubscription.ts`
- Primary CRM files:
  - `src/routes/_app.leads.tsx`
  - `src/components/crm/LeadDetailDrawer.tsx`
  - `src/components/crm/PipelineView.tsx`
  - `src/routes/_app.clients.tsx`
  - `src/routes/_app.billing.tsx`
  - `src/routes/_app.payouts.tsx`
  - `src/routes/_app.campaigns.tsx`
  - `src/routes/_app.email-marketing.tsx`
  - `src/routes/_app.workflows.index.tsx`
  - `src/routes/_app.workflows.$workflowId.tsx`
  - `src/routes/_app.settings.tsx`
  - `src/components/crm/TeamMembers.tsx`
  - `src/components/crm/WhiteLabelSettings.tsx`
  - `src/components/crm/EmailAuditLog.tsx`
- Server function hardening targets:
  - `src/functions/*.functions.ts`
  - `src/routes/lovable/email/transactional/send.ts`
  - `src/routes/lovable/email/queue/process.ts`

## Launch sequencing

1. Auth and post-login gating
2. Leads/outreach/email logs
3. Clients/billing/payouts
4. Campaigns/email marketing
5. Workflows
6. Settings/team/white-label
7. Full end-to-end verification and console cleanup
