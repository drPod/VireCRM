# Genesis CRM — Issues & Build Log

Living doc. Append as found. Caveman OK.

Last scan: 2026-05-17. Source: agent-browser tour of `/` marketing + source-tree audit of `src/routes/`.

---

## Fixes shipped 2026-05-17 (orchestrator session)

All deployed to prod (Supabase project `coynbufhejaeuifpvmvw` + Vercel `genesisxsx.vercel.app`). Migrations applied via `supabase db push`; edge fns deployed via `supabase functions deploy`.

| Commit | What |
|---|---|
| `9f629f8` | Captcha required on `/api/public/contact` (was `.optional()` → bypassable by omission). Tier-sim buttons on dashboard gated behind `import.meta.env.DEV`. Migration `20260517133315_lock_down_security_definer_funcs.sql` REVOKEs EXECUTE on 60+ SECURITY DEFINER fns from anon/public (135 → ~41 WARN advisors). |
| `9da5486` | 17 edge fns migrated `corsHeaders` → `buildCorsHeaders(req)`; `vercel.app` + `.vercel.app` added to `ALLOWED_ORIGIN_SUFFIXES`. Verified live: OPTIONS returns 200 for `genesisxsx.vercel.app` + `localhost:8080`. |
| `a2b7aa8` | 13 routes given proper `head` meta titles (`/unsubscribe`, `/sequences`, `/followup-inbox`, `/academy*`, `/energy*`); 404 page sets title; `/campaigns/analytics` deleted (was duplicate); `/settings` accepts `?tab=` search param + `/settings/branding-preview` "Publish" routes to White-Label tab; `/billing` Lifetime renewal row reads "Never"; `scripts/restart-dev.sh` + CLAUDE.md note for stale-env Vite gotcha. |
| `449b7bc` | Mobile drawer in `MarketingHeader` rewritten on top of Radix `Sheet` — portal, scrim, body scroll lock, `role=dialog`, focus trap. Drawer CTAs split into outline + filled-primary for hierarchy. |
| `ddbec7d` | `/checkout/return` no longer flips to success after 30s timeout when `hasAccess` still false — new failure card w/ "Retry activation check" + "Contact support" + visible session_id. Plan label on dashboard `CreditUsageWidget` derives from `useSubscription()` (same source as sidebar + `/billing`); lifetime users see "No usage limits" instead of Starter fallback. |
| `7bfa168` | 17 vertical routes (energy + 7 sub, solar + 1 sub, real-estate + 2 sub, insurance + 2 sub, gym) wrapped in shared `<IndustryGate industry="…">`. Mismatched workspaces see empty state w/ "Go to dashboard" + "Contact platform admin" CTAs instead of full vertical UI. |
| `dc4df81` | Security pass 2 — 4 cron hooks (`calculate-payouts`, `send-pending-welcomes`, `dispatch-sequences`, `purge-audit-log`) switched from "any non-empty bearer" to `x-cron-secret` + `process.env.CRON_SECRET` (matching 3 already-correct siblings). `bookPublicAppointmentFn` now requires math captcha + honeypot, per-IP rate limit (8/10min, 30/24h) via new `public_booking_attempts` table, 60s dedup window. `create-checkout` + `create-reseller-checkout` edge fns auth-gate via `supabase.auth.getUser`; body `userId`/`organizationId` must match caller. Verified live: unauth POST to `create-checkout` returns 401. |
| `48f5e2c` | Migration adds `contact_submissions.lead_id uuid REFERENCES leads(id)` + partial index. App selected the column but it didn't exist → REST returned 42703, UI lied "no submissions". Regenerated `src/integrations/supabase/types.ts`. |
| `__PICKER_SHA__` | Industry picker + sidebar reveal. (1) Migration `20260517150107_allow_owner_industry_change.sql` updates `guard_industry_template_change` trigger to permit org owners (was platform-admin-only) + extends `log_template_change` audit metadata w/ actor_role. Existing `template_assignment_audit_log` covers it — no new table. (2) `OnboardingWizard` no longer skips industry step for non-platform-admin owners; all owners walk through the 3-step flow. (3) New `IndustryTemplatePicker` card in `/settings?tab=industry` — owner-only Select + AlertDialog confirm, theme + modules reseed on switch. (4) `CrmSidebar` shows all 5 vertical sections always under "Verticals"; mismatched ones render muted with lock icon + tooltip, still clickable. (5) `IndustryGate` empty-state CTA points at `/settings?tab=industry` instead of dead `/admin` link, copy adapts for owner vs non-owner. Also: stripped trailing CLI version-update text accidentally appended to `src/integrations/supabase/types.ts` ("is not a module" typecheck error). |

### Manual follow-ups (user)

- Set `CRON_SECRET` in Vercel prod env. Update any external scheduler / pg_cron job calling the 4 fixed hooks to pass `x-cron-secret: $CRON_SECRET` (otherwise they'll 401 silently).
- Decide `LOVABLE_API_KEY` direction: re-add key (`supabase secrets set LOVABLE_API_KEY=…` + Vercel env) OR migrate 11 callsites (`src/lib/ai-gateway.ts`, `src/lib/contact/classify-submission.ts`, `src/lib/connectors/gateway.ts`, `src/lib/resend.ts`, `src/routes/lovable/email/**`, `src/functions/connectors.functions.ts`, `src/functions/auto-outreach.functions.ts`) to direct Anthropic/OpenAI.
- Toggle on `auth_leaked_password_protection` in Supabase Auth → Password protection (not migration-able).
- Stale 3 test users in `auth.users` (`audit-1779023439@…`, `qa+audit-1779023449@…`, `qa+audit-1779023457@…`) — SQL ready at line ~452, kept per "don't auto-delete" note.

### Out of scope (need product call)

- Workflow execution engine — half-built, banner is honest but flagship feature
- `/clients` reseller mgmt — single CTA, full UI not wired
- `/gym` member-health ingest UI — no way to add records
- `/preview` fake CRM — kill or wire to real demo data
- `/features` content — duplicate of landing
- 30% off promo expiry / coupon wiring in Stripe

---

## Public-facing (marketing) issues

### Routing
- **`/signin` → 404.** Real route is `/login`. `/signin` is natural guess. Add redirect or alias route.
- **`/features` = verbatim duplicate of landing's lower sections.** Either intentional one-pager flatten or never built distinct content. Decide: kill the route, or write real feature deep-dive.

### `/preview` (marketing fake CRM)
- Sidebar lists 14 modules. **Only Dashboard renders demo widgets** — Pipeline / Hot leads / Live activity, all static.
- 13 of 14 sidebar items render identical upsell card: *"X is part of the full CRM"*. Misleading vs reality: the modules ARE built (see auth-gated section below). Either:
  - Wire `/preview` modules to real read-only demo data, OR
  - Keep upsell shell but make copy honest ("Sign up to access").
- "New Lead" button disabled with no tooltip explaining why.
- Static demo data on Dashboard widgets — pipeline numbers, lead names, activity timestamps don't change. Looks fake.

### Marketing copy / structure
- `/contact` "security question with regenerate button" — captcha-style. Unconfirmed if validation works server-side. Verify.
- `/signup` requires checkbox accepting Terms + No-Refund. Behavior correct, but Create-account button disabled state has no error hint until click.
- 30% off promo banner top of every page — verify expiry / actual coupon wiring in Stripe.
- Footer links + phone number — verify they're real, not Lovable placeholder.

---

## Auth-gated CRM (the real app) — discovered via source audit, NOT browser-verified

**Important:** preview agent didn't reach these. All gated by `/_app` layout (src/routes/_app.tsx) which requires Supabase session + active subscription. To audit live, need to sign up + pay (or seed test account + bypass `useSubscription`).

**Live audit attempt 2026-05-17:** blocked at email-confirm gate (see "Browser-verified" section below). Couldn't reach `_app.*`. Screenshots `/tmp/genesisxsx-audit/01-21*.png`.

### Route inventory (~50 routes)

**Core CRM:**
- `/dashboard` — command bar + metrics + pipeline + activity + advisor audit log + credit usage
- `/leads` — main leads pipeline
- `/messages`, `/conversations` — comms
- `/campaigns`, `/campaigns/analytics`
- `/workflows`, `/workflows/$workflowId`
- `/calendar`, `/appointments`
- `/sequences`, `/funnels`, `/email-marketing`, `/followup-inbox`
- `/revenue`, `/payouts`, `/expenses`, `/invoices`
- `/reputation`, `/advisor` (AI advisor), `/analytics`
- `/billing`, `/settings`, `/settings/branding-preview`
- `/admin` (platform admin), `/command-chat`, `/contact-submissions`
- `/dns-check`, `/qa-checklist`
- `/academy`, `/academy/$courseId`
- `/clients`, `/clients/payouts`, `/clients/plans` (white-label / reseller mgmt)

**Industry-specific verticals** (suggests multi-tenant template system):
- `/energy` + `/energy/contracts`, `/customers`, `/loa`, `/pricing`, `/renewals`, `/suppliers`, `/usage`
- `/gym`
- `/solar`, `/solar/projects`
- `/real-estate`, `/listings`, `/showings`
- `/insurance`, `/policies`, `/quotes`

**Public-but-unlisted:**
- `/accept-invite`, `/book/$slug`, `/checkout/return`, `/confirm-email`
- `/reset-password`, `/payment-status`, `/unsubscribe`
- Reseller subdomain pages: `/r/$resellerSlug/index`, `/signup`, `/checkout/$planSlug`
- `/sitemap.xml`

**API + cron hooks (server routes):**
- `/api/notify-low-balance`
- `/api/public/contact`, `/hooks/classify-contact-submissions`, `/contact-followup-reminders`, `/dispatch-followups`, `/dispatch-sequences`, `/purge-audit-log`
- `/hooks/calculate-payouts`, `/send-pending-welcomes`
- `/lovable/email/auth/preview` + `/webhook`, `/queue/process`, `/suppression`, `/transactional/preview` + `/send`
- `/email/unsubscribe`

### Auth-gated stack (inferred)
- Supabase auth (Google OAuth + email/pw)
- Subscription gate (`useSubscription`) → redirects to `/billing` if no active sub. Only `/billing` + `/settings` reachable without sub.
- Onboarding wizard auto-launches on first sign-in (`OnboardingWizard` — industry selector: general/energy/gym/solar/real_estate/insurance, brand color, strict lead isolation)
- Product tour auto-opens once onboarding done (`ProductTour` w/ `DEFAULT_TOUR_STEPS`)
- Multi-org (organization_id on profile)
- Role-based (owner role checked in onboarding)
- Stripe Connect for payouts (component exists)
- Custom domains + white-label theming (DomainBrandingProvider, WhiteLabelTheme, CustomDomainsPanel)
- AI advisor with credit ledger + audit log
- n8n webhook integration
- Apollo lead import
- "Auto-find leads" w/ BYO API key (mentioned in pricing)

### Open questions before building out
- Which routes are real vs Lovable-scaffolded stubs? Need per-route audit.
- Test account button exists (`src/components/admin/TestAccountButton.tsx`) — does it bypass subscription? Use for dev.
- `LeadsSmokeTest` component exists — what does it cover?
- `UI_QA_CHECKLIST.md` in `docs/` — read before changes (existing QA baseline).
- Supabase schema state: `supabase/` dir exists. Migrations applied? RLS policies tight?
- 959 packages installed (`bun pm ls`). Audit `package.json` for unused Lovable SDK bloat (`@lovable.dev/*` packages — `cloud-auth-js`, `email-js`, `webhooks-js` — keep or replace?).

---

## Backend state (2026-05-17)

- New Supabase project `genesisxsx` (ref `coynbufhejaeuifpvmvw`, us-east-1). Original Lovable instance abandoned.
- All 108 migrations applied + stamped in `supabase_migrations.schema_migrations`.
- 84 public tables, 82 public functions.
- Pooler region prefix is `aws-1` (not `aws-0`).
- Advisors hardening pass 1 (migration `20260517133315_lock_down_security_definer_funcs.sql`): 135 → ~41 WARN. Anon-callable funcs: 65 → 6 (intentional: signup/reseller/domain provider). Auth-callable: 70 → ~34 (admin panel + white-label + lead ops — by design, RLS gates data inside). Remaining WARNs = advisor noise on intentional surface.
- Outstanding advisor: `auth_leaked_password_protection` disabled — enable in dashboard Auth → Password protection (not migration-able).
- Migration `20260417054233_*` stamped but actual SQL never ran (skipped by prior session — old Lovable cron URL `auto-pilot-sales-ace.lovable.app/hooks/send-pending-welcomes`). `cron.job` empty. Need: edit URL to new host or remove cron.
- All 25 edge functions deployed (`supabase functions list` confirms). Most error at call-time without env secrets (STRIPE_SECRET_KEY, LOVABLE_AI_KEY, RESEND_API_KEY, etc) — set via dashboard or `supabase secrets set`.
- Test user seeded: `darsh.pod@gmail.com` / `TestPass123!`, owner role, `Darsh Test's Organization`, manual subscription active until 2027-05-17.

## Build-out priorities (TBD — fill as we go)

- [ ] Get test account / bypass billing gate for local dev
- [ ] Audit each `_app.*` route: real impl vs stub vs broken
- [ ] Read `docs/UI_QA_CHECKLIST.md`
- [ ] Inspect supabase schema + RLS
- [ ] Decide: kill `/preview` fake or hook to real demo data
- [x] Fix `/signin` 404 → redirects to `/login` (preserves `?redirect=` param)
- [x] Tooltip on disabled `/preview` "New Lead" button → "Sign up to create leads…"
- [x] Signup disabled-button hint → shows "Accept Terms…" until checkbox ticked
- [ ] Decide `/features` content

---

## Auth-gated browser audit — pass 2 (2026-05-17, post env-fix)

Scope: ~33 `_app.*` routes. Bypassed auth via service-role API: created pre-confirmed user `audit-1779023439@genesisxsx-audit.local` (id `07ec78b5-…`), inserted manual sub row (env=manual, status=active, 90-day window), profile + org auto-created by trigger (org `385535bd-…`). Creds at `/tmp/genesisxsx-audit/test-email.txt`. Screenshots `/tmp/genesisxsx-audit/22-63*.png`.

### Pre-audit blocker uncovered

Vite dev server had stale env baked into bundle — old Lovable Supabase URL `mtcthkzvpfctjanehgdr.supabase.co` instead of `coynbufhejaeuifpvmvw.supabase.co`. Login to seeded user failed silently w/ "invalid credentials" because bundle hit abandoned project. Fix: kill all `vite dev` processes + restart so updated `.env` loads. Recommend `scripts/restart-dev.sh` + pre-dev hook printing resolved `VITE_SUPABASE_URL`. Note in CLAUDE.md.

### Onboarding + tour flow

- Sign-in works after env fix.
- OnboardingWizard fires on first login.
- **Skips step 0 (industry picker) silently for non-platform-admin owners.** `OnboardingWizard.tsx:60-62` locks template to `general` and starts at brand-color step. Owner can never pick own industry — wizard's own comment says ask platform admin via `/admin`. No `/settings` affordance to request change.
- Brand color + privacy steps work cleanly.
- ProductTour auto-opens after dashboard mount. Welcome dialog. Skip dismisses cleanly.

### Routes audited — all 33 render w/ real h1/h2, zero console errors

| Section | Route | Status | Note | PNG |
|---|---|---|---|---|
| Core | /dashboard | works | command bar, pipeline cols, credit usage, activity feed | 25, 27 |
| Core | /leads | works | list UI, filters, bulk actions, 0 leads | 28 |
| Core | /messages | works | empty state | 29 |
| Core | /conversations | works | empty state | 30 |
| Core | /campaigns | works | empty state + analytics button | 31 |
| Core | /workflows | works | empty state | 32 |
| Core | /calendar | works | May 2026 month view | 33 |
| Core | /appointments | works | "Calendars" h2 | 34 |
| Core | /sequences | works | empty state | 35 |
| Core | /funnels | works | stats grid + 3 tabs + create CTA | 36 |
| Core | /email-marketing | works | campaign list empty | 37 |
| Core | /followup-inbox | works | tabs + Generate-batch CTA | 38 |
| Core | /command-chat | works | suggestion buttons + textarea | 49 |
| Core | /advisor | works | strategy form, 100 analyses remaining | 44 |
| Revenue | /revenue | works | trend + P&L + 12-mo summary | 39 |
| Revenue | /payouts | works | Pending/Paid tabs + commission CTA | 40 |
| Revenue | /expenses | works | empty | 41 |
| Revenue | /invoices | works | "Connect Stripe" gate visible | 42 |
| Revenue | /analytics | works | pipeline breakdown + reply rate, all zeros | 45 |
| Revenue | /reputation | works | review-request flow | 43 |
| Revenue | /academy | works | empty course list + create-course CTA | 53 |
| Revenue | /billing | **partial** | Lifetime card OK but **"Failed to send a request to the Edge Function"** at history section | 27, 60 |
| Workspace | /settings | works | Team/Roles/White-Label/Emails/Outreach/Payments/Integrations | 47 |
| Admin | /admin | works | "Restricted" gate (audit user not platform admin) | 48 |
| Admin | /clients | works | "Become reseller" CTA — gated until reseller mode on | 54 |
| Admin | /contact-submissions | **partial** | UI loads, REST query returns 400, lies "No submissions match" | 50, 61 |
| Admin | /dns-check | works | "Platform admin required" gate | 51 |
| Admin | /qa-checklist | works | full 6-step QA checklist UI | 52 |
| Vertical | /energy | works | 7 sub-modules (LOA/Usage/Pricing/Contract/Suppliers/Renewals/Customers) | 55, 62 |
| Vertical | /gym | works | At-risk members + member goals; reads `member_health` (empty) | 56, 63 |
| Vertical | /solar | works | 9-stage pipeline + default modules | 57 |
| Vertical | /real-estate | works | 7-stage pipeline (re-uses solar's IndustryHub) | 58 |
| Vertical | /insurance | works | 8-stage pipeline (re-uses IndustryHub) | 59 |

### NEW bugs / regressions

1. **[blocker] Edge-function CORS hardcoded to Lovable preview URL.** `supabase/functions/_shared/stripe.ts:124` exports `corsHeaders` w/ `"Access-Control-Allow-Origin": "https://genesisxsx.lovable.app"`. 17 edge functions import bare `corsHeaders`: `list-billing-history`, `customer-portal`, `create-checkout`, `connect-stripe-account`, `admin-invoice-action`, `void-lead-invoice`, `revoke-manual-subscription`, `reset-client-password`, `manage-org-features`, `list-manual-subscriptions`, `grant-manual-subscription`, `get-stripe-price`, `create-submission-invoice`, `create-reseller-checkout`, `create-quote-payment-link`, `create-lead-invoice`, `create-client-account`. All return `Failed to fetch` from `http://localhost:8080` AND from prod `genesisx.space`. Only `verify-checkout-session` uses dynamic `buildCorsHeaders(req)` helper already in same file. **Every Stripe-mediated flow dead** (checkout, customer-portal, sub mgmt, invoice issuance, billing history, manual sub admin, reseller checkout, lead invoices, quote payment links, Stripe Connect). Fix: migrate 17 funcs to `buildCorsHeaders(req)`. Repro: `curl -X OPTIONS https://coynbufhejaeuifpvmvw.supabase.co/functions/v1/list-billing-history -H "Origin: http://localhost:8080" -i`.

2. **[major] `contact_submissions.lead_id` column doesn't exist.** REST returns `{"code":"42703","message":"column contact_submissions.lead_id does not exist"}`. `src/routes/_app.contact-submissions.tsx:100-105` selects `…classification_error,lead_id`. Either drop `lead_id` from select OR migration `ALTER TABLE contact_submissions ADD COLUMN lead_id uuid REFERENCES leads(id)`. Check `_app.admin.tsx` for same pattern.

3. **[major] Silent-failure-lying-as-empty-state UI pattern.** `/contact-submissions` shows "No submissions match the current filters" on 400. `/checkout/return` shows "You're all set!" on Stripe timeout. `/billing` swallows CORS failure as single in-page string. **No global unhandled-rejection toast.** Need shared `Result<T>` error-surface convention OR dev-mode global rejection handler that toasts.

4. **[major] `LOVABLE_API_KEY` not set.** Captured from dev-server log during audit: `classify-submission: failed { msg: 'LOVABLE_API_KEY is not configured' }`. 11 files reference it (`src/lib/ai-gateway.ts`, `src/lib/contact/classify-submission.ts`, `src/lib/connectors/gateway.ts`, `src/lib/resend.ts`, all `src/routes/lovable/email/**`, `src/functions/connectors.functions.ts`, `src/functions/auto-outreach.functions.ts`). AI classification + auto-outreach + transactional email broken until replaced. Decide: keep Lovable AI gateway w/ key, or migrate to direct Anthropic/OpenAI.

5. **[minor] OnboardingWizard skips industry picker for non-platform-admins.** Owner can never escape `general` template w/o admin. No `/settings` affordance to request change. Either expose template picker to owners (w/ audit log) or add "request industry change" UI.

6. **[minor] Verticals hidden from sidebar unless `org.industry` matches** (`CrmSidebar.tsx:118-147`). Combined w/ #5, entire vertical product offering invisible to most owners.

7. **[minor] `/billing` Lifetime plan shows "Renews Aug 15, 2026".** Should say "Never" or hide renewal row for Lifetime/Paid-externally. Cosmetic.

### Build-out gaps

- **/clients** — single CTA "Enable in Settings". Reseller toggle exists but full client mgmt UI not wired. ~1-2 days.
- **/admin** — gated 100% on platform-admin. Couldn't audit. Add "you would see X if admin" preview for docs.
- **/gym** — 184 LOC, reads `member_health` direct. No way to add member-health record or visit tracking. Need ingest UI or auto-populate-from-leads migration.
- **/dashboard credit usage** tier buttons (Starter/Growth/Pro/Ownership) render w/o visible data binding. Verify wiring.
- **/gym** doesn't use solar's `IndustryHub` like real-estate/insurance do. Extend so gym hub gets same modular pipeline shell.

### Cross-cutting issues

- Stale-env Vite gotcha (above) — needs script + CLAUDE.md note.
- 17 edge functions broken cross-origin (bug #1) — biggest single finding.
- Silent fetch failures everywhere (bug #3).
- Verticals invisible to most owners (bugs #5 + #6).

---

## Browser-verified audit — pass 1 (2026-05-17, pre env-fix)

Scope: unauth-reachable surface. `_app.*` routes NOT reached — see "Auth gate reality" below. Screenshots `/tmp/genesisxsx-audit/01-21*.png`. Throwaway creds in `test-email.txt`.

### Auth gate reality

Signup w/ throwaway `audit+<ts>@example.com` lands on `/confirm-email`. Supabase project enforces email verification. `/login` w/ unverified creds → Sonner toast "Please confirm your email first — check your inbox for the verification link." No way past without:
- real inbox
- toggle off email confirm in Supabase Auth settings (dev project)
- DB-side `auth.users.email_confirmed_at` UPDATE (parallel DB agent's lane)
- `TestAccountButton` — but `useAuthedServerFn(createTestAccount)` requires already-authed session, so useless for bootstrap. Chicken-egg.

All gated routes correctly 302 → `/login?redirect=<path>`. Verified for `/dashboard`, `/leads`, `/messages`, `/campaigns`, `/workflows`, `/calendar`, `/revenue`, `/settings`, `/admin`, `/energy`, `/solar`, `/real-estate`, `/insurance`, `/academy`, `/qa-checklist`, `/advisor`, `/command-chat`, `/billing`, `/dns-check`. Sub gate + onboarding wizard + product tour unreachable.

### Unauth routes — per-route status

| Route | Status | Note | PNG |
|---|---|---|---|
| `/login` | works | `/signin` 302→here, preserves `?redirect=` | 01, 05b |
| `/signup` | works | submits → `/confirm-email` | 02, 03, 04 |
| `/confirm-email` | works | resend-confirmation toast OK | 07 |
| `/reset-password` | works | inputs disabled w/o token (correct) | 08 |
| `/payment-status` | works | "sandbox" env label, manual session-id verify | 09 |
| `/accept-invite?token=…` | works | 302 → `/signup?invite=…` | 10 |
| `/unsubscribe` | partial | renders invalid-token state, **`<title>` not set** — falls back to default landing title | 11 |
| `/checkout/return?session_id=test` | partial | spinner runs 30s (15 attempts × 2s, `checkout.return.tsx:35`), then flips to misleading "You're all set!" success UI even when sub never appeared | 14 |
| `/book/$slug` | works | clean "Booking link unavailable" | 15 |
| `/r/$resellerSlug` | works | "Workspace not found" | 16 |
| `/r/$slug/checkout/$plan` | works | "Plan not found" + home link | — |
| `/contact` | **broken (server)** | captcha + client validation OK, POST → toast "Server not configured". Console: `contact: missing supabase env vars`. `src/routes/api/public/contact.ts:90` reads `process.env.SUPABASE_SERVICE_ROLE_KEY` — unset in local `.env` | 17-20 |
| `/features` | partial | renders, ISSUES already flags duplicate content | 21 |
| `/sitemap.xml` | works | 9 public URLs, valid XML | — |

### New findings (not in baseline above)

1. **`SUPABASE_SERVICE_ROLE_KEY` missing from local `.env`.** Breaks `/contact` POST + every server-side service-role call. 16 files import it (`src/routes/api/public/contact.ts`, `src/routes/lovable/email/**`, `src/routes/hooks/**`, `src/routes/api/notify-low-balance.ts`, `src/integrations/supabase/client.server.ts`, etc.). Almost certainly all silently 500ing. Restore from secrets vault / 1Password / Supabase dashboard.
2. **`/checkout/return` success-UI lies on failure.** Timeout = 30s then unconditional flip to "You're all set!" green-checkmark card regardless of `hasAccess`. User pays, webhook never lands → app says "all set" → user thinks they have access → bounces off `/dashboard` w/ sub gate. Need: if `!hasAccess` after timeout, show explicit "Payment received but activation delayed — contact support" + retry button + support link. `src/routes/checkout.return.tsx:55-82`.
3. **`/unsubscribe` page title not set on error state.** SEO + tab-title bug. Likely missing `head: () => ({ meta: [{ title: ... }] })` in route config.
4. **`TestAccountButton` bootstrap gap.** Designed as "skip-the-gate dev shortcut" per ISSUES question #3 above, but gated behind auth. Expose `createTestAccount` via dev-only unauth endpoint (gated `NODE_ENV !== "production"` + dev secret) — or move it onto `/login` as "Dev: spawn test account" button when env is dev.

### Build-out priorities — append

- [ ] Restore `SUPABASE_SERVICE_ROLE_KEY` in local `.env` (likely all server-side flows broken w/o it)
- [ ] Fix `/checkout/return` lying-on-failure UI (see finding #2)
- [ ] Add `<title>` to `/unsubscribe` error state
- [ ] Disable email-confirm in dev Supabase project OR add `seedConfirmedUser` dev fn so audits can bootstrap
- [ ] Audit every `process.env.SUPABASE_SERVICE_ROLE_KEY` site for graceful degradation (currently throws 500, no fallback message to user)
- [ ] Once auth unblocked: re-run audit, cover `_app.*` routes (~50)

---

## Landing-page audit (2026-05-17, agent-browser tour)

### Fixed
- [x] **Top email bar:** dark text on dark navy bg → swapped to `text-white/70` + `text-white`
- [x] **Mobile promo banner:** "View plans →" CTA clipped on mobile → mobile-specific copy variant
- [x] **Footer Company column:** `<span>` "About"/"Careers" pretending to be links → removed, added `Contact` link
- [x] **Favicon missing** → added `<link rel="icon">` to root meta (favicon.ico + png + apple-touch)
- [x] **OG image:** gpt-engineer scaffolding URL → swapped to `https://genesisx.space/genesis-logo.png`

### Open (visual / a11y)
- [ ] **Mobile menu drawer:** no backdrop scrim — page content visible beneath drawer, breaks modal illusion
- [ ] **Mobile drawer "Sign In":** plain text vs `Start Free Trial` button — inconsistent affordance
- [ ] **Top nav "Home"** has no active state when on `/`
- [ ] **30% off promo:** no expiry date — weakens urgency, looks placeholder. Decide: ends date, or "first 100 customers"

### Open (build / deploy)
- [ ] **Production build serving Vite HMR artifacts** — console shows `[vite] hot updated`, `connection lost` chatter. Deployed bundle may be dev build, not `vite build` output. Verify deploy pipeline.

### Open (verification, not fixes)
- [ ] **Hero "See It In Action" → `/preview`** — confirm preview route is intended demo, not stub
- [ ] **Footer phone `+1 (940) 365-6600`** — looks real (Texas area code), tel: link wired. Confirm actually routed somewhere live.
- [ ] **Captcha on `/contact`** — server-side validation not confirmed

---

## Audit continuation (2026-05-17, session genesisxsx-tour)

### Confirmed / closed

- **[CONFIRMED] Production build is prod, NOT dev.** `<head>` loads hashed assets `assets/index-B4wGb1pd.js`, `MarketingHeader-D-xxM6-v.js`, etc. No `@vite/client`, no `__VITE_HMR__`, no HMR socket. Prior `[vite] hot updated` chatter must've been local dev session, not prod deploy. Close item from line 180.
- **[CONFIRMED] `/features` = duplicate landing content.** H2/H3 sequence identical from "Your Business Is Already Losing Money Here" onward; landing body 5347 chars, `/features` 3148 chars (just missing hero + "Two Ways" section). Already in ISSUES, re-verified.
- **[CONFIRMED] No horizontal overflow** at 320 / 375 / 768 / 1024 on `/`, `/pricing`, `/preview`. `scrollWidth === clientWidth` at every checkpoint.
- **[CONFIRMED] `/preview` 13 non-Dashboard sidebar items render identical upsell template.** Sampled Leads, Messages, Analytics, AI Advisor — same copy ("X is part of the full CRM" + "Sign up for a free trial to unlock x, AI automations…"). Template properly interpolates module name. Already in ISSUES.
- **[CONFIRMED] `/contact` captcha** = math question ("What is N + M?") w/ regenerate button. Client-side validation toast "Incorrect answer. Please try again." Question rotates on failed submit. **Did NOT verify server-side validation** — previous agent already flagged server-route 500 on missing `SUPABASE_SERVICE_ROLE_KEY`.
- **[CONFIRMED] 30% off promo: no expiry date anywhere.** Copy = "limited time launch promo." No site-wide expiry text. Already flagged.

### New findings

1. **[major] `/about` route = 404.** `https://genesisx.space/about` renders custom 404 page (h1 "404", "Page not found"). But `<title>` falls through to default landing title `"Genesis — AI CRM that follows up so your team can close"` instead of "404 — Genesis". Same bug class as `/unsubscribe` title bug from prev audit. Also: footer "About" should either link somewhere or be removed (currently `<span>` non-link).
   - Repro: open `/about`
   - Fix: add 404 catch-all route in TanStack router w/ proper `head: () => ({ meta: [{ title: "404 — Genesis" }] })`, OR create real `/about` page.

2. **[minor] Top nav `aria-current="page"` set, but ZERO visual active state.** Home link on `/` has `aria-current="page"` + class `active` applied, but computed styles identical to inactive nav links: both `color: oklch(0.5 0.03 290)`, `font-weight: 500`, `border-bottom: 0px`. CSS rule for `.active` or `[aria-current=page]` missing or overridden.
   - Repro: visit `/`, inspect any nav link vs Home link computed styles
   - Fix: add `[aria-current=page] { color: var(--foreground); font-weight: 600; }` or underline. Tailwind users: `aria-[current=page]:text-foreground aria-[current=page]:font-semibold`.

3. **[major] Mobile drawer: NO backdrop scrim, NO body scroll lock.** At 375×812, click hamburger (button "Open menu") → nav links inject inline into header DOM (NOT a portaled modal). Scrolling `window.scrollTo(0, 300)` succeeds while drawer open (`scrollY: 300`). No `[role=dialog]`, no `[aria-modal]`, no `data-state=open` overlay element exists. `body.style.overflow` stays `visible`. Page content visible+scrollable behind drawer.
   - Repro: 375px viewport → open menu → scroll window → page scrolls under drawer
   - Fix: convert to Radix `<Sheet>` / `<Drawer>` with built-in portal + backdrop + scroll-lock, or manually toggle `body { overflow: hidden }` + add fixed-position scrim `<div className="fixed inset-0 bg-black/50 z-40" />`.

4. **[minor] Mobile drawer "Sign In" affordance inconsistent w/ "Start Free Trial".** Sign In btn: `bg: transparent`, `border: none`, `color: muted-dark`. Start Free Trial: `bg-primary/10`, `border: 1px solid primary/20`, `color: primary`. Both presented as primary nav actions in drawer but one looks like a text link and one looks like a button.
   - Repro: 375px → open drawer → compare two bottom buttons
   - Fix: either give Sign In matching outline/ghost variant explicitly, or step up Trial to filled `bg-primary text-primary-foreground` so the visual hierarchy reads "secondary action / primary action".

5. **[minor] Footer "About" / "Careers" still render as non-link `<span>` text.** Changelog line 14 says these were removed, but markup still has:
   ```
   {tag: "SPAN", text: "About", href: null}
   {tag: "SPAN", text: "Careers", href: null}
   ```
   Either deploy hadn't picked up the fix, OR fix only converted `<a>` → `<span>` without removing the element. Visually still readable as "Company" links, just dead. Also: changelog claimed Contact link added — not present.
   - Repro: footer of any public page
   - Fix: remove the `<span>` elements entirely, or wire to real pages.

6. **[nit] `/preview` upsell copy: lowercased module name in interpolation.** "Sign up for a free trial to unlock **ai advisor**, AI automations…" — reads ungrammatical. Should be Title Case (`AI Advisor`) or proper-cased per module (`leads` → `Leads`, `messages` → `Messages`).
   - Repro: `/preview` → click "AI Advisor" sidebar item → read upsell card
   - Fix: pass display name through interpolation, not `.toLowerCase()`.

7. **[minor] `/pricing` has no explicit currency.** All prices are bare `$` glyph (`$68`, `$594`, etc.). No "USD" / "US$" anywhere. Non-US visitors may assume CAD/AUD/SGD/HKD. Stripe charges in USD regardless.
   - Repro: `/pricing`
   - Fix: append "USD" to plan price labels, or add small "All prices in USD" disclaimer above plan grid.

8. **[nit] `/pricing` mixed CTA verbs.** Done-For-You plans = "Get Started", Custom CRM = "Contact Us", White-Label leases = "Start Lease", White-Label Custom = "Contact Us", final pricing-page CTA = "Apply to Get Your AI CRM System Built". 4 different action verbs for "buy/start" intent. Mostly intentional (different commercial flows: self-serve checkout vs sales contact vs lease application) but worth reviewing for clarity.
   - Repro: scroll `/pricing`
   - Fix: optional. If kept, make sure each verb maps cleanly to a flow type and is consistent across all plans of that type.

9. **[blocker-adjacent / info] Could not test captcha server-side validation.** Prev audit already documented `SUPABASE_SERVICE_ROLE_KEY` missing breaks `/contact` POST → "Server not configured" toast. So captcha → server roundtrip not verifiable until env restored. The math captcha is trivially bypassable from a script (eval the visible question, POST answer). Once server works, recommend Cloudflare Turnstile or hCaptcha instead.

### Notes / can't-do

- Did NOT add screenshots — used AXTree + `eval` throughout per instructions ("AXTree first, screenshots only when AXTree fails"). All findings derivable from snapshot + computed-style dumps.
- Did NOT close session `genesisxsx-tour` — left running per instructions.
- Did NOT touch session `genesisxsx-crm-audit` — `session list` showed only `genesisxsx-tour` active at audit start anyway.
- Viewport sweep used `set viewport <w> 800` + reload. agent-browser supports it natively, no Playwright fallback needed.

---

## Gated CRM audit (2026-05-17, test account)

Scope: signed in as `qa+audit-1779023457@genesisx.test` (Lifetime / Paid externally, manual sub). Session `genesisxsx-tour`. Screenshots `/tmp/genesisxsx-audit/23-27*.png`. Auth + onboarding wizard + product tour all flowed clean. Skipped tour, completed wizard (brand color #3b82f6, strict lead isolation OFF). Landed on `/dashboard`.

### Cross-cutting

1. **[major] Page `<title>` falls back to default landing title on 4+ routes.** `/sequences`, `/followup-inbox`, `/academy`, `/energy` all show `"Genesis — AI CRM that follows up so your team can close"` in browser tab. SEO + UX bug. Same class as `/unsubscribe` + `/about` title bugs from prior audits.
   - Repro: navigate to any of those, `document.title` shows landing fallback
   - Fix: add `head: () => ({ meta: [{ title: "Sequences — Genesis" }] })` to each route file. Audit all `_app.*` route files for missing meta.

2. **[major] Plan label inconsistency between sidebar + dashboard credit panel.** Sidebar shows `Current plan LIFETIME`. Billing page shows `Lifetime / Paid externally · Active`. **Dashboard credit-usage card shows `starter plan · April 2026`** (lowercase, with quota 250, "Used 0", "Remaining 250"). Three different plan labels in three places for the same user.
   - Repro: sign in with lifetime user → compare sidebar pill, `/billing` heading, dashboard credit-usage panel
   - Fix: derive plan label from one source (`useSubscription().plan` or DB column). Credit panel currently hardcoded fallback or pulling from different table. For lifetime/manual subs, credit quotas should display "Unlimited" or the actual entitlement, not "Starter Plan · April 2026".

3. **[blocker] "Tier change simulation" buttons exposed on dashboard.** Below credit-usage card on `/dashboard`, four buttons appear: `Starter / Growth / Pro / Ownership`. Labeled "Tier change simulation" — clearly a QA/dev affordance. Clicking these likely mutates client state (or worse, DB) and could let a non-owner self-elevate or break credit accounting. Should be feature-flagged behind dev env / platform-admin role.
   - Repro: `/dashboard` → scroll to Credit usage card → see four tier buttons
   - Fix: gate `<TierChangeSimulation>` behind `import.meta.env.DEV` or `usePlatformAdmin()`. Definitely not visible to a real paying customer.
   - Screenshot: `/tmp/genesisxsx-audit/24-dashboard-tier-sim.png`

4. **[minor] Onboarding wizard dialog missing `aria-describedby`.** Console warns: `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}`. Same warning fires for product-tour dialog. Radix a11y contract violation.
   - Fix: add `<DialogDescription>` element inside each `<DialogContent>` OR pass `aria-describedby` explicitly.

### `/dashboard`

5. **[minor] Industry verticals ungated for `general` industry org.** Test org is `general` industry, but `/energy` renders the full Energy CRM page (LOA Requests, Usage Requests, Supplier directory, etc.) with no industry-mismatch warning or redirect. Same for `/solar`, `/real-estate`, `/insurance`, `/gym` (not all tested but route shape suggests same pattern). Task brief specifically expected "redirect or empty state" for industry routes when org is `general`.
   - Repro: `/energy` while industry=general → full energy CRM renders
   - Fix: industry-route loader should check `org.industry === <route_industry>` and either redirect to `/dashboard` or show "Switch industry to Energy in Settings to enable this module."

6. **[nit] Command-bar input has `[disabled]` send button + no visible hint why.** Top of `/dashboard`, big "Type a command..." textbox with adjacent send button. Send button is `disabled` until user types something. No tooltip / aria-label explaining the disabled state — matches the pattern flagged in prior audits.
   - Fix: add tooltip "Type a command to send" on disabled state, or remove the disabled affordance (let click trigger validation).

### `/leads`

7. **[confirmed working] Add Lead flow persists.** Clicked "Add Lead" → modal opened with proper fields (Name, Company, Email, Phone, Status, Notes). Filled "Test Lead Audit / Audit Co / audit@example.com" → submit → list updated to "1 total leads in pipeline", pipeline "New" column shows the lead with score 50. No toast confirmation though — silent success.
   - **[nit] No success toast after lead create.** Most apps confirm. Inconsistent with pattern.
   - Screenshot: `/tmp/genesisxsx-audit/26-leads-with-test-lead.png`

8. **[info] `Test account` + `Smoke test` buttons visible on `/leads` toolbar.** Probably scoped to authed sessions, fine in dev, should be gated by `import.meta.env.DEV` or platform-admin role in prod. If those buttons hit privileged seed/cleanup endpoints they're a privesc surface.
   - Fix: audit `src/components/admin/TestAccountButton.tsx` + `LeadsSmokeTest` for env / role gates.

### `/workflows`

9. **[major] Workflow execution engine NOT shipped.** Workflows page renders builder UI but explicit banner: *"Builder preview. Design and save your workflows now. Triggers will start firing on real lead events when the execution engine ships — your saved drafts will switch on automatically."* Honest but means a flagship "Automate" feature is half-built. Drafts + Marked Ready / Paused / Total counters all 0.
   - Repro: `/workflows` → see preview-mode banner
   - Recommendation: either prominently mark this module as "Beta" everywhere it's surfaced (sidebar, marketing, pricing), or push execution engine before launching. Currently invisible until user lands on the page.
   - Screenshot: `/tmp/genesisxsx-audit/25-workflows-preview-warning.png`

### `/campaigns/analytics`

10. **[major] `/campaigns/analytics` renders identically to `/campaigns`.** Both URLs return the same component (heading "Campaigns", "Automated outreach sequences" + "No campaigns yet" empty state). No actual analytics view exists at the `/analytics` sub-path. Either dead route or unfinished split.
    - Repro: diff `document.querySelector('main').textContent` between `/campaigns` and `/campaigns/analytics` → identical
    - Fix: either remove the route from router, or build the analytics view (campaign-level reply rates, conversion, sends-over-time).

### `/settings/branding-preview`

11. **[major] Sub-route doesn't open intended tab.** `/settings/branding-preview` renders the same Settings page as `/settings`, defaulting to the Team tab. The intent was clearly to deep-link into the White-Label / branding preview view. Title is correctly `Genesis — Branding Preview` but the tab content is wrong.
    - Repro: navigate `/settings/branding-preview` → Team tab shows, not White-Label
    - Fix: Settings page should read sub-path → open matching tab on mount. Or extract branding preview into its own route component.

### `/admin`, `/dns-check`

12. **[confirmed working]** Both correctly show "Restricted / Platform admin required" message. Owner role is gated separately from platform-admin role — correct.

### `/messages`, `/conversations`, `/campaigns`, `/calendar`, `/appointments`, `/sequences`, `/funnels`, `/email-marketing`, `/followup-inbox`, `/revenue`, `/invoices`, `/reputation`, `/advisor`, `/analytics`, `/expenses`, `/payouts`, `/contact-submissions`, `/qa-checklist`, `/clients`, `/clients/payouts`, `/clients/plans`, `/command-chat`, `/academy`

All render cleanly with thoughtful designed empty states. No crashes, no blank screens, no lorem ipsum. `/qa-checklist` is genuinely well-built (6-step buyer-flow checklist). `/revenue` renders MRR/ARR/profit charts with proper $0 empty state. `/advisor` shows ICP generator with "100 analyses remaining" credit counter.

### `/billing`

13. **[confirmed working] Manual / lifetime sub displays correctly.** Heading: `Lifetime / Paid externally · Active`. Started / Renews / Lifetime access labels populate. "Refresh" button + "Download invoices" section all present. No upgrade-CTA spam for paying customer.
    - Screenshot: `/tmp/genesisxsx-audit/27-billing-lifetime.png`

### Overall posture

App is **substantially built**, not a Lovable shell. ~28 gated routes audited, zero crashes, zero blank screens, zero lorem-ipsum, every page has thoughtful designed-empty-state copy. Critical CRUD flow (`Add Lead`) persists end-to-end. Auth + onboarding wizard + product tour all functional. Big honest signal: Workflows page openly tells the user the execution engine isn't shipped yet — half-built but at least transparent. The most embarrassing finding is the **Tier change simulation buttons left on the production dashboard** — that's a dev affordance that needs feature-flagging *yesterday*. After that: plan-label triplication (LIFETIME / Lifetime / starter plan all for the same user) erodes trust, and 4+ routes falling back to default landing title is a polish gap that compounds with the marketing-side title bugs already flagged. Industry verticals (`/energy` et al.) appear ungated regardless of org industry — either dead routes or missing guard. No security-grade issues surfaced via UI; RLS posture is the parallel agent's lane. Total work to ship-clean: ~1 day to fix the title bugs, plan-label, tier-sim gate, branding-preview route, and `/campaigns/analytics` dead path.

---

## Server-side + DB audit (2026-05-17, service-role restored)

### Captcha bypass via field omission (PROVEN, PROD)

**[critical] `POST /api/public/contact` accepts payloads with NO `captcha` field at all.** Schema (`src/routes/api/public/contact.ts:64-70`) marks captcha as `.optional()`, so server only validates when `captcha` is in the body. Curl-tested against `https://genesisx.space/api/public/contact` (prod):

```
{"name":"X","email":"x@y.test","message":"no captcha"} → HTTP 200 {"success":true}
{"name":"X","email":"x@y.test","message":"...","captcha":{"a":2,"b":3,"answer":4}} → HTTP 400 (wrong)
{"name":"X","email":"x@y.test","message":"...","captcha":{"a":2,"b":3,"answer":5}} → HTTP 200 (correct)
```

So the math captcha works ONLY against clients that bother to send it. Bots ignoring the field bypass entirely. Honeypot + rate-limit + dedup still apply, but captcha provides zero protection.

- Fix: drop `.optional()` — make captcha required. OR (better) replace math captcha w/ Cloudflare Turnstile (`@marsidev/react-turnstile`) since Cloudflare is already the deploy target.
- Same `.optional()` audit needed on every public POST endpoint (`/r/$slug/signup`, `/accept-invite`, etc.).

### Stale test data created during this audit

Three test users sit in `auth.users` from bootstrap iterations. Don't auto-delete — leaving for owner to revoke:
- `audit-1779023439@genesisxsx-audit.local` (org `385535bd…`) — from prior subagent run
- `qa+audit-1779023449@genesisx.test` (org `b4ae7574…`) — from failed curl that actually succeeded via trigger
- `qa+audit-1779023457@genesisx.test` (org `38cc4f86…`) — **active**, used by gated-CRM audit, has manual subscription + 1 test lead

Cleanup SQL when ready:
```sql
DELETE FROM auth.users WHERE email IN (
  'audit-1779023439@genesisxsx-audit.local',
  'qa+audit-1779023449@genesisx.test',
  'qa+audit-1779023457@genesisx.test'
);
-- profiles, user_roles, subscriptions, leads cascade via FK
DELETE FROM public.organizations WHERE id IN (
  '385535bd-610c-4d8b-a066-2c5cd5940699',
  'b4ae7574-ac38-4e6e-b5da-21e5893129a5',
  '38cc4f86-aa7d-452e-8827-2dc731cc260c'
);
```

### Supabase Security Advisors — 136 findings, all WARN, all SECURITY category

Full dump: `~/.claude/projects/-Users-darshpoddar-Coding-genesisxsx/e181f3b1-…/tool-results/mcp-plugin_supabase_supabase-get_advisors-1779024220123.txt`

**Headline: 63 `SECURITY DEFINER` functions in `public` schema are anon-callable via `/rest/v1/rpc/<fn>`** — i.e. anyone with the publishable key (which ships in the browser bundle) can invoke admin/billing/credit/payout/role mutators with NO sign-in. Each function runs as `postgres` so RLS is bypassed; only the function body's `has_role` / `user_has_permission` calls stand between an attacker and an org-takeover — and those auth helpers are themselves anon-callable.

**[critical] Anon-callable mutators that should be service-role only:**

| Function | Risk |
|---|---|
| `admin_set_org_plan`, `admin_set_org_plan_by_email`, `webhook_grant_plan_by_email` | anon changes billing plans |
| `admin_financial_overview`, `admin_list_organizations`, `admin_org_billing`, `admin_submission_payment_history` | anon reads admin financials |
| `grant_credit_pack`, `apply_credit_plan`, `consume_credit`, `consume_platform_lead_quota` | anon mutates credit ledger |
| `assign_custom_role`, `update_member_role`, `remove_org_member`, `share_lead`, `unshare_lead` | anon mutates RBAC + lead sharing |
| `delete_lead`, `delete_email` | anon deletes data |
| `add_custom_domain`, `remove_custom_domain`, `mark_custom_domain_verified`, `set_primary_custom_domain` | anon controls custom domains |
| `calculate_reseller_payouts`, `mark_payout_paid`, `mark_earning_paid` | anon mutates payouts |
| `accept_invitation`, `signup_under_reseller`, `handle_new_user` | anon mutates membership/onboarding |

**[high] Auth-only but still wrong:** `admin_list_platform_admins`, `admin_set_org_industry`, `grant_platform_admin_by_email`, `revoke_platform_admin`, `is_platform_admin` — callable by any signed-in user (so every paying customer can attempt platform-admin grant). Should be service-role only.

**[low-medium]** Auth: leaked-password protection (HaveIBeenPwned check) is disabled in Supabase Auth settings.

Lint breakdown:
- `0028 anon_security_definer_function_executable` — 65 fns
- `0029 authenticated_security_definer_function_executable` — 70 fns (superset of 0028)
- `auth_leaked_password_protection` — 1

Fix template:
```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM anon, authenticated, public;
-- if intentionally callable by signed-in users:
GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;
-- best: ALTER FUNCTION ... SECURITY INVOKER + add proper RLS policies on touched tables
```

Docs: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Did NOT flag: RLS-disabled tables (none — all 84 public tables have RLS ON), missing policies, exposed schemas, function `search_path` issues. Either clean or out of scope for this advisor run.

### RLS posture (read-only check)

- All 84 `public.*` tables have `rls_enabled=true`. Good baseline.
- Existing data lives in 4 orgs (1 owner's, 3 mine from this audit), 4 user_roles, 3 subscriptions. Bulk of tables empty (clean install).
- Did NOT exhaustively audit policy correctness per table — only that RLS is on. Per-table policy audit is its own pass (recommend: SQL dump of `pg_policies` filtered to `public`, then walk through each table's policy set for tenant isolation correctness).

---

## Security pass 2 audit (2026-05-17)

Read-only sweep over every public-reachable POST in the codebase, modelled on the `/api/public/contact` bug class (server validation that no-ops when client omits a field). Reference fix: `src/routes/api/public/contact.ts` lines 50-70 (captcha now required, honeypot required, IP rate-limit + dedup window).

### Findings

#### 1. `bookPublicAppointmentFn` — zero abuse protection (CRITICAL)
- File: `src/functions/appointments.functions.ts` lines 540-620
- Route: any visitor of `/book/$slug` (also callable directly via TanStack server-fn endpoint)
- Schema (line 540-548):
  ```ts
  const publicBookSchema = z.object({
    calendarId: z.string().uuid(),
    starts_at: z.string(),
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    phone: z.string().max(40).optional(),
    notes: z.string().max(2000).optional(),
    password: z.string().max(200).optional(),  // <-- ONLY enforced if calendar.access_password_hash IS NOT NULL
  });
  ```
- **No captcha. No honeypot. No rate limit. No origin check.** `password` is `.optional()` — same class of bug as the original contact bug, BUT: `loadPublicCalendarOrThrow` *does* re-check `if (hash) { if (!password) throw }` (line 398-401). So password-gated calendars are safe. **But every non-password calendar (the default) is wide open.** Attacker can:
  - Spam every public booking slug with fake bookings → fills owner's calendar, denies real bookings.
  - Inserts a fake `leads` row per unique email submitted (line 587 — `insert into leads`). Pollute every reseller's CRM with garbage leads, all tagged `source: "booking_link"`.
  - Burn through whatever per-slot conflict detection there is by exhausting available slots.
- Severity: **CRITICAL** (silent lead-table pollution across tenants + DoS of any public calendar)
- Minimal fix:
  1. Add honeypot field + math-captcha to `publicBookSchema` (mirror contact.ts pattern).
  2. Add per-IP rate-limit table or reuse `contact_submissions`-style counter (5 / 10min, 20 / 24h).
  3. Add dedup window: same `(calendarId, email, starts_at)` within 60s → return success without insert.
  4. Verify `Origin` header against an allowlist before processing (the edge functions already do this via `buildCorsHeaders` — port the same allowlist here).

#### 2. `verifyCalendarPasswordFn` — unbounded password guess oracle (MAJOR)
- File: `src/functions/appointments.functions.ts` lines 454-462
- Public endpoint, no rate limit, no captcha, no lockout. Returns 200/throw based on password match. Attacker brute-forces calendar access passwords offline-equivalent (scrypt is slow but server pays cost; still trivially abusable with cheap parallelism).
- Severity: **MAJOR** (password-gated calendars assumed private; this endpoint makes them effectively guessable for short passwords)
- Minimal fix: per-IP+calendarId attempt counter (e.g. 5 failed tries / hour → 429 + delay).

#### 3. `getAvailableSlotsFn` — same surface as #1, scrape vector (MINOR)
- File: `src/functions/appointments.functions.ts` lines 468-538
- No auth, no rate limit. Anyone can enumerate every public calendar's availability + booked slot deltas (by subtraction: hit twice, see what disappeared = booked time). Not a validation bypass but is the recon endpoint that feeds #1.
- Severity: **MINOR** (privacy + scraping; not corrupting state)
- Minimal fix: per-IP rate limit on the public slot endpoint.

#### 4. `/hooks/calculate-payouts` — "auth" check accepts ANY non-empty token (CRITICAL)
- File: `src/routes/hooks/calculate-payouts.ts` lines 14-24
- Vulnerable lines:
  ```ts
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401 });
  }
  // ← then proceeds to call supabase.rpc("calculate_reseller_payouts") with SERVICE ROLE
  ```
  Token value is never compared to a secret. Anyone sending `Authorization: Bearer x` can trigger the monthly payout calculation against arbitrary `periodStart`/`periodEnd` from request body. RPC runs with `SUPABASE_SERVICE_ROLE_KEY`.
- What attacker gets: force-recompute payouts for any period (potentially overwriting `pending` rows), DoS of an expensive RPC, possibly cause double-counting if the RPC isn't fully idempotent on partial states.
- Severity: **CRITICAL** (financial calc tampering + cron-replay DoS)
- Minimal fix: compare token to `process.env.CRON_SECRET` (already the pattern used by `contact-followup-reminders.ts`, `dispatch-followups.ts`, `classify-contact-submissions.ts`):
  ```ts
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```

#### 5. `/hooks/send-pending-welcomes` — same "any-token" bug (MAJOR)
- File: `src/routes/hooks/send-pending-welcomes.ts` lines 41-51
- Identical pattern to #4: token presence check only. Anyone can trigger the welcome-email queue drain → mass-replay welcome emails (if any `pending_welcome_emails` rows have `send_after <= now`). Also costs your transactional email quota.
- Severity: **MAJOR** (email spam vector + quota burn; not financial, hence not critical)
- Minimal fix: same — compare to `CRON_SECRET` (or `SUPABASE_SERVICE_ROLE_KEY` like `lovable/email/queue/process.ts` does).

#### 6. `/api/public/hooks/dispatch-sequences` — same "any-token" bug (MAJOR)
- File: `src/routes/api/public/hooks/dispatch-sequences.ts` lines 90-102
- Vulnerable lines:
  ```ts
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) { return 401 }
  const supabase = createClient(VITE_SUPABASE_URL!, token, { ... });
  ```
  Token is fed to `createClient` as the auth — but `createClient(url, key, ...)` treats the second arg as the **client key**, not an auth token, so any non-empty string passes the early gate and Supabase later rejects on RLS. **However**, since `outreach_sequence_enrollments` etc. likely have RLS that requires `service_role` or org membership, the actual writes may fail — but the function still does the (expensive) enrollment scan, hydration of leads/orgs/templates, and the work loop. **Confirm RLS on `outreach_sequence_enrollments` / `outreach_sequences`** — if any are anon-readable, this becomes worse.
- Severity: **MAJOR** (DoS + likely info leak depending on RLS; demote to MINOR only if you confirm every table touched here has anon=deny)
- Minimal fix: switch to `CRON_SECRET` header check (same as `dispatch-followups.ts` does correctly).

#### 7. `/api/public/hooks/purge-audit-log` — same "any-token" bug (MAJOR)
- File: `src/routes/api/public/hooks/purge-audit-log.ts` lines 7-22
- Identical pattern. Calls `supabase.rpc("purge_advisor_audit_log")` with whatever token was supplied. The RPC is `SECURITY DEFINER` per migration `20260423080340_*` (and was reinforced in `20260517133315_lock_down_security_definer_funcs.sql`), so this either no-ops on anon (good) or actually purges (bad) depending on the GRANT. **Audit the GRANT on `purge_advisor_audit_log`** — if `anon` or `authenticated` has EXECUTE, any logged-in user (or anon) can wipe the audit log.
- Severity: **MAJOR** pending the GRANT check; **CRITICAL** if anon has EXECUTE.
- Minimal fix: switch to `CRON_SECRET` gate + `REVOKE EXECUTE ON FUNCTION public.purge_advisor_audit_log FROM anon, authenticated`.

#### 8. `supabase/functions/create-checkout` — unauth, accepts arbitrary `userId`/`organizationId` metadata (MAJOR)
- File: `supabase/functions/create-checkout/index.ts` lines 9-77
- Listed in `supabase/config.toml` as `verify_jwt = false`. Body fields `userId`, `attributedResellerId`, `resellerPlanId`, `organizationId` are taken verbatim and stamped onto `session.metadata`. Anyone can create a Stripe checkout session with arbitrary stamping.
- What attacker gets: actual fraudulent grant requires the attacker to pay Stripe (webhook signature is verified, so just calling the webhook doesn't help). But:
  - Can mint a session whose `metadata.organizationId` points at someone else's org — if anyone pays it (e.g. attacker tricks a victim into completing checkout via a phishing link to the embedded checkout client_secret), credits land in the attacker's chosen org.
  - Can cause arbitrary upserts into `transactions`/`subscriptions` mapped to unrelated `userId`s if attacker pays for trivial-cost line items.
  - Discount-promo abuse: forces `launch30` coupon onto every session forever.
- Severity: **MAJOR** (real money required, but cross-tenant attribution corruption is possible end-to-end)
- Minimal fix: require auth on `create-checkout` (set `verify_jwt = true` in `config.toml` OR validate the bearer in-function and ensure `userId == authed user id` + caller has membership in `organizationId`). `verify-checkout-session` already does this — mirror that pattern. Keep `get-stripe-price` public (read-only price lookup is fine).

#### 9. `supabase/functions/get-stripe-price` — `priceId` regex permits abuse (MINOR)
- File: `supabase/functions/get-stripe-price/index.ts` lines 11-16
- No auth, no rate limit. Regex `/^[a-zA-Z0-9_-]+$/` permits brute-enumerating any Stripe price lookup_key. Cost: 1 Stripe API call per request. Attacker can DoS Stripe quota or scrape the full pricing matrix.
- Severity: **MINOR** (info-only, Stripe rate-limits will eventually fire)
- Minimal fix: per-IP rate-limit (10/min) and short cache of resolved lookup_keys.

### Inventory of public endpoints

| Endpoint | Method | Auth | Rate limit | Captcha | Honeypot | Origin check | Signature |
|---|---|---|---|---|---|---|---|
| `POST /api/public/contact` | POST | none | yes (IP + dedup) | required (math) | yes (website) | no | no |
| `POST /api/public/hooks/classify-contact-submissions` | POST | `x-cron-secret` | n/a | n/a | n/a | no | no |
| `POST /api/public/hooks/dispatch-followups` | POST | `x-cron-secret` | n/a | n/a | n/a | no | no |
| `POST /api/public/hooks/contact-followup-reminders` | POST | `x-cron-secret` | n/a | n/a | n/a | no | no |
| `POST /api/public/hooks/dispatch-sequences` | POST | **broken** (any token) | n/a | n/a | n/a | no | no |
| `POST /api/public/hooks/purge-audit-log` | POST | **broken** (any token) | n/a | n/a | n/a | no | no |
| `POST /hooks/calculate-payouts` | POST | **broken** (any token) | n/a | n/a | n/a | no | no |
| `POST /hooks/send-pending-welcomes` | POST | **broken** (any token) | n/a | n/a | n/a | no | no |
| `POST /api/notify-low-balance` | POST | JWT + owner role | n/a | n/a | n/a | no | no |
| `POST /lovable/email/auth/webhook` | POST | n/a | n/a | n/a | n/a | no | **HMAC (LOVABLE_API_KEY)** |
| `POST /lovable/email/suppression` | POST | n/a | n/a | n/a | n/a | no | **HMAC (LOVABLE_API_KEY)** |
| `POST /lovable/email/transactional/send` | POST | JWT | n/a | n/a | n/a | no | no |
| `POST /lovable/email/transactional/preview` | POST | `LOVABLE_API_KEY` bearer | n/a | n/a | n/a | no | no |
| `POST /lovable/email/auth/preview` | POST | `LOVABLE_API_KEY` bearer | n/a | n/a | n/a | no | no |
| `POST /lovable/email/queue/process` | POST | `SERVICE_ROLE_KEY` bearer | n/a | n/a | n/a | no | no |
| `GET/POST /email/unsubscribe` | GET/POST | unsub token (per email) | no | n/a | n/a | no | no (RFC 8058 one-click) |
| `GET /sitemap.xml` | GET | none | n/a | n/a | n/a | n/a | n/a |
| `POST` getPublicCalendarFn (TanStack server fn) | POST | none | no | no | no | no | no |
| `POST` verifyCalendarPasswordFn (TanStack server fn) | POST | none | **no** | no | no | no | no |
| `POST` getAvailableSlotsFn (TanStack server fn) | POST | none | no | no | no | no | no |
| `POST` bookPublicAppointmentFn (TanStack server fn) | POST | none | **no** | **no** | **no** | no | no |
| Edge fn `payments-webhook` (verify_jwt=false) | POST | n/a | n/a | n/a | n/a | n/a | **HMAC (Stripe webhook secret)** |
| Edge fn `create-checkout` (verify_jwt=false) | POST | **none** | no | no | no | CORS only | no |
| Edge fn `create-reseller-checkout` (verify_jwt=false) | POST | **none** | no | no | no | CORS only | no |
| Edge fn `get-stripe-price` (verify_jwt=false) | POST | **none** | **no** | no | no | CORS only | no |
| Edge fn `verify-checkout-session` (verify_jwt=false) | POST | JWT + session.metadata.userId match | n/a | n/a | n/a | CORS only | no |
| Edge fn `create-submission-invoice` (verify_jwt=false) | POST | JWT + `is_platform_admin` RPC | n/a | n/a | n/a | CORS only | no |
| All other supabase edge fns (verify_jwt=true) | POST | JWT enforced by Supabase | depends | n/a | n/a | CORS only | n/a |

### Recurring anti-pattern

Four cron-style routes (`#4`-`#7`) all share the same broken auth shape:

```ts
const token = request.headers.get("authorization")?.replace("Bearer ", "");
if (!token) return 401;
// ... proceeds with service-role work
```

The token value is never validated against a secret. Three siblings (`classify-contact-submissions`, `dispatch-followups`, `contact-followup-reminders`) do it correctly with `x-cron-secret` + `CRON_SECRET` env var. Pick one convention (recommend `x-cron-secret` to match the existing 3) and fix all four sites in one PR.

### Notes / non-findings

- All `lovable/email/*` routes properly gated (HMAC, service-role bearer, or LOVABLE_API_KEY bearer).
- `/email/unsubscribe` correctly uses token + atomic compare-and-swap; safe as-is.
- All TanStack server fns under `src/functions/*.ts` that use `requireSupabaseAuth` middleware are properly auth-gated — the `.optional()` fields in those schemas are on auth-required surface, so they're not in scope of this bug class.
- Supabase edge functions NOT in `config.toml` default to `verify_jwt = true` per Supabase platform behavior — confirmed by reading individual fns (they call `supabase.auth.getUser(token)` and reject on failure).
- Signup pages (`/signup`, `/r/$resellerSlug/signup`) call `supabase.auth.signUp` directly — abuse protection (captcha, rate limit) is configured at the Supabase Auth project level, not in app code.
