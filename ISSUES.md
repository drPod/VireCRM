# Genesis CRM — Issues & Build Log

Living doc. Append as found. Caveman OK.

Last scan: 2026-05-17. Source: agent-browser tour of `/` marketing + source-tree audit of `src/routes/`.

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
- 730 packages installed. Audit `package.json` for unused Lovable SDK bloat (`@lovable.dev/*` packages — `cloud-auth-js`, `email-js`, `webhooks-js` — keep or replace?).

---

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
