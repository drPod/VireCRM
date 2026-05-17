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
- Advisors: 0 ERROR, 135 WARN — all `SECURITY DEFINER` funcs callable by `anon`/`authenticated`. Critical risk on admin_*, webhook_grant_plan_by_email, grant_credit_pack, mark_*_paid, accept_invitation. Needs revoke + grant cleanup.
- Migration `20260417054233_*` stamped but actual SQL never ran (skipped by prior session — old Lovable cron URL `auto-pilot-sales-ace.lovable.app/hooks/send-pending-welcomes`). `cron.job` empty. Need: edit URL to new host or remove cron.
- `SUPABASE_SERVICE_ROLE_KEY` not yet in `.env`. Needed for edge fn deploy + admin ops.

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

## Browser-verified audit (2026-05-17, session `genesisxsx-crm-audit`)

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
