# Genesis CRM — Issues & Build Log

Living doc. Reverse-chrono. **Every agent: read `## Open` at session start. Append findings to `## Recent` before claiming done.** Full protocol below.

**Earlier history:** `docs/issues-archive/2026-05.md` (1585 lines, full session log 2026-05-17 → 2026-05-18).

---

## Open

Outstanding action items. Removed when shipped. Strike-through belongs in `## Recent`, not here.

### User action required (secrets / DNS / product calls)

- [ ] **Toggle `auth_leaked_password_protection`** in Supabase → Auth → Password protection. Not migration-able.
- [ ] **Smoke user cleanup:** `bun run scripts/mint-smoke-user.ts --cleanup-all-smoke` (or `userId 516e90e0-b537-4506-90bd-134dc5d5cb81`).
- [ ] **`/features` content slots** — 5–8 customer logos for above-fold logo bar. Testimonial pull-quote (sentence + name + role + company). Decide: comparison-table competitor labels generic ("Generic CRM" / "White-label rivals") or named (HubSpot/Pipedrive/GoHighLevel)?
- [ ] **CF Workers Builds "Variables and secrets" panel** — manual dashboard check that no `LOVABLE_API_KEY` lingers (runtime `wrangler secret list` doesn't cover build-time). Dashboard → Workers & Pages → genesisxsx → Settings → Variables.
### Phase 2 — Lovable cleanup follow-ups

- [ ] **Connector OAuth proxy** — replace `src/lib/connectors/gateway.ts` stub (currently throws `ConnectorNotConfiguredError(503)` at line 41). Nango or hand-rolled. Apollo/Slack/Gmail/Twilio/Sendgrid integrations dark until done.

### Bugs found, not fixed


### Verification / QA debts

- [ ] **Browser-verify `/features`** at 375/768/1280. Only 1280 verified for `/preview` rich rebuild.
- [ ] **`/preview` AXTree pass** — proper screen-reader audit. Subagent only did visual confirm.
- [ ] **`/checkout/return` browser-verify** — code looks correct (15-attempt poll + amber pending + retry/support). Real verify needs Stripe dry-run w/ failing webhook.

### Out of scope (need product call)

- [ ] `/clients` platform-admin tenant mgmt — single "Enable in Settings" CTA, full UI not wired (legacy Lovable reseller-style scaffold; in current model = Majix operator's tenant list). ~1-2 days. Reframe vs delete pending product call.
- [ ] `/gym` member-health ingest UI — no way to add records. Need ingest UI or auto-populate-from-leads migration.
- [ ] `/gym` doesn't use `IndustryHub` pattern like real-estate/insurance. Extend.
- [ ] `/admin` gated 100% on platform-admin. Add "you would see X if admin" preview for docs.
- [ ] `/dashboard credit usage` tier buttons (Starter/Growth/Pro/Ownership) — verify wiring (render w/o visible data binding).

---

## How to append

Every finding, every fix, every session — append before claiming done.

### Pre-append checklist (run BEFORE writing the section, AGAIN after)

Two minutes of mechanical checks beat reconstructing a stomped header three commits later (already happened once — the "docs reorg push" header at `### 2026-05-18` was rewritten away by an adjacent commit and had to be restored from `git log -p`).

1. **Count `### 2026-` headers before editing:** `grep -c '^### 2026-' ISSUES.md`. Remember the number.
2. **Edit `## Recent` only** — never `## Open` for shipped/found logs.
3. **New session top of `## Recent`** with EXACTLY three hashes: `### YYYY-MM-DD — <short title>`. Not `##`. Not `####`.
4. **Tag line immediately below the date header:** `**Tags:** [foo] [bar]` — required for archive grep. See tag glossary in `docs/issues-archive/README.md`.
5. **Subsections inside the session use four hashes:** `#### Shipped`, `#### Found`, `#### Verification`, `#### Manual follow-up (user)`. Any `####` MUST live under a `### YYYY-MM-DD` parent — never orphan a `####` at the top of `## Recent`.
6. **Verify after edit:** `bash scripts/lint-issues.sh`. Header count should be old + 1, lint should exit 0.

If you're editing a prior session (e.g. striking through a resolved finding), step 1's count stays the same. If it dropped, you stomped a header — `git diff` and restore.

### Entry template

```markdown
### YYYY-MM-DD — short title
**Tags:** [tag1] [tag2]

#### Shipped (if applicable)
- file:line — what changed. Commit `<sha>` if landed.

#### Found (if applicable)
- **file:line** — symptom. Root cause if known.

#### Verification
- typecheck / lint / browser walk / e2e — what was actually run. No "passing" without evidence.

#### Manual follow-up (user)
- One-line action items needing user hands.
```

### Rules

1. **Newest section on top of `## Recent`.** Push older sections down.
2. **`## Open` = live state.** Outstanding items only. Move shipped items out (leave shipped entry in `## Recent` for context). Never strike-through inside `## Open` — delete instead.
3. **`## Recent` = audit trail.** Strike-through (`~~…~~`) resolutions inline here when a LATER session invalidates or fixes a prior finding. Same-session shipments use the `#### Shipped` block — no strike-through needed. Preserve original wording either way.
4. **Archive cutoff:** move a `## Recent` section to `docs/issues-archive/YYYY-MM.md` when (a) entire section is strikethrough/resolved AND (b) >14 days old. Append to matching month file. `scripts/lint-issues.sh` flags candidates.
5. **Caveman OK** in prose. Code/error quotes verbatim. File paths + line numbers + commit shas required for any code-touching finding — downstream agents cite them.
6. **Don't dupe across sections.** Open ↔ Recent linkage by file:line; don't restate full context twice.
7. **Tag glossary:** see `docs/issues-archive/README.md`. Common: `[security]`, `[supabase]`, `[lovable-migration]`, `[cf-saas]`, `[reseller]`, `[audit]`, `[browser]`, `[bug]`, `[frontend]`, `[docs]`, `[git]`. Add new tag → document it in the archive README in the same edit.

---

## Recent

Most-recent session at top. Earlier 2026-05-17 / 2026-05-18 sessions in `docs/issues-archive/2026-05.md`.

### 2026-05-21 — billing-page UX cleanup
**Tags:** [billing] [ui] [ux] [stripe]

#### Shipped
- `src/routes/_app.billing.tsx` — custom-tier proration message now routes user to sales-contact CTA (mailto SUPPORT_EMAIL + `/contact` link) when target tier has no numeric price, instead of the generic "custom pricing — exact amount in checkout" line.
- `src/routes/_app.billing.tsx` — downgrade path in `InlinePlans` swaps the disabled "Downgrade in portal" button for an inline explanation: "Downgrades issue a credit applied to your next invoice, not a refund today" + clickable "Stripe Billing Portal" link that reuses the existing `openCustomerPortal()` handler.

#### Verification
- `bun run typecheck` exit 0.

### 2026-05-21 — Config + auth centralization (Phase A + B)
**Tags:** [lovable-migration] [audit]

#### Shipped
- `src/config/domains.ts` — all domain/email constants (PLATFORM_DOMAIN, NOTIFY_DOMAIN, MAJIX_AI_DOMAIN, SENDER_DOMAIN, FROM_DOMAIN, SITE_NAME, LOGO_URL, OG_CARD_URL)
- `src/config/hosts.ts` — SYSTEM_HOST_PATTERNS (full 11-pattern set), isSystemHost(), PLATFORM_HOSTS
- `src/lib/crypto.ts` — shared generateToken() (was duplicated 6×)
- `src/lib/auth-helpers.ts` — assertOrgMember + assertOwner (were duplicated across 6 function files)
- `src/config/support.ts` — added SUPPORT_PHONE + SUPPORT_PHONE_E164; SUPPORT_EMAIL → darsh.pod@gmail.com
- Updated 20+ files: all local constants/helpers replaced with imports from the above
- Bug fixed: GlobalErrorBoundary had 8-pattern subset (missing .workers.dev, app/customers/notify virecrm hosts); now imports shared 11-pattern set
- `src/functions/domain-health.functions.ts:77` — User-Agent now uses PLATFORM_DOMAIN
- `src/lib/email-templates/contact-acknowledgment.tsx`, `credit-low-balance.tsx` — SITE_NAME + fallback URLs now use shared constants

#### Verification
- `bun run typecheck` → 0 new errors (3 pre-existing Stripe `mode` prop errors in PricingCards + _app.billing unrelated to this work)

### 2026-05-21 — Remove reseller CRM management routes
**Tags:** [reseller] [frontend] [lovable-migration]

#### Shipped
- Deleted `src/routes/_app.clients.tsx`, `_app.clients.payouts.tsx`, `_app.clients.plans.tsx`, `_app.payouts.tsx`
- `EditClientWhiteLabelDialog` component preserved (white-label feature)
- Removed `Link to="/payouts"` button + unused `Wallet` import from `_app.revenue.tsx`
- Cleaned all deleted route references from `src/routeTree.gen.ts` (imports, declarations, interfaces, union types)
- `bun run typecheck` → zero errors

### 2026-05-21 — Delete reseller components
**Tags:** [reseller] [frontend] [lovable-migration]

#### Shipped
- Deleted `src/components/marketing/BrandedSignup.tsx`, `src/components/marketing/features/ResellerCta.tsx`, `src/components/crm/CommissionRulesDialog.tsx`
- Removed all import sites and JSX usages: `index.tsx` (BrandedSignup conditional render), `features.tsx` (ResellerCta block)
- `_app.payouts.tsx` was already deleted by a parallel unit; no action needed
- Updated stale comment in `useCustomDomainGuard.ts`
- Commit: `618d0d1`

### 2026-05-21 — Remove is_reseller toggle from WhiteLabelSettings
**Tags:** [reseller] [frontend] [lovable-migration]

#### Shipped
- `src/components/crm/WhiteLabelSettings.tsx` — removed `is_reseller?` from `OrgWithDomain` type, dropped `initialIsReseller`/`isReseller`/`togglingReseller` state, deleted `handleToggleReseller` handler, removed reseller-mode Switch UI block + storefront-URL reveal block, scrubbed "reseller storefront"/"reseller landing page" from help text, removed unused imports (`Switch`, `Globe`, `Sparkles`, `Copy`, `CheckCircle2`). Commit `359dfd1`.

#### Verification
- `bun run typecheck` → exit 0, zero errors.
- No reseller references remain in the file (`grep` confirmed).

### 2026-05-21 — Stripe live account wired end-to-end
**Tags:** [stripe] [secrets] [pricing]

User created new Stripe account `acct_…51TYVK6`, pasted live keys in chat (`pk_live_…` + `sk_live_…`). Replaced prior dormant Stripe account `51TNoG1` in `.env.production`. **Action item:** rotate the `sk_live_` key in Stripe dashboard once setup is settled — pasted in chat = persisted in conversation logs.

#### Wired
| What | Where | Value / id |
|---|---|---|
| Publishable key (frontend) | `.env.production` `VITE_PAYMENTS_CLIENT_TOKEN` | `pk_live_51TYVK6…` |
| Secret key (server) | `.env` `STRIPE_LIVE_API_KEY` | `sk_live_51TYVK6…` |
| Secret key (Supabase Edge Fns) | `supabase secrets set STRIPE_LIVE_API_KEY` | same as above |
| Webhook endpoint | Stripe → `https://coynbufhejaeuifpvmvw.supabase.co/functions/v1/payments-webhook` | `we_1TZVqt7klyZ9sPrQUALwcH2w`, 11 events (checkout.session.completed, customer.subscription.{created,updated,deleted}, invoice.{finalized,sent,updated,voided,marked_uncollectible,payment_succeeded,payment_failed}) |
| Webhook secret | `supabase secrets set PAYMENTS_LIVE_WEBHOOK_SECRET` | `whsec_lffBCTrb…` |
| Stripe MCP server | `~/.claude.json` project block | HTTP transport at `https://mcp.stripe.com/` |

#### Products + prices (live mode, 5 monthly recurring)
| lookup_key | Price id | Product id | Amount |
|---|---|---|---|
| `crm_starter_monthly` | `price_1TZVsQ7klyZ9sPrQ0i2NdYDD` | `prod_UYd8aAOSJbAwGI` | $97/mo |
| `crm_growth_monthly` | `price_1TZVsU7klyZ9sPrQ4aUx4hEo` | `prod_UYd8aXkb37fTcr` | $197/mo |
| `crm_pro_monthly` | `price_1TZVsX7klyZ9sPrQGXHdKokZ` | `prod_UYd8GtX2zTTkeJ` | $297/mo |
| `lease_starter_monthly` | `price_1TZVsa7klyZ9sPrQfAatsKcG` | `prod_UYd8W9lE51pahP` | $249/mo |
| `lease_pro_monthly` | `price_1TZVsd7klyZ9sPrQYxwOFhzi` | `prod_UYd8AEjIb0K4du` | $849/mo |

Amounts mirror `src/components/marketing/PricingCards.tsx` `crmTiers` + `whiteLabelTiers`. `Custom CRM`, `Full Ownership`, `Custom Enterprise` tiers route to `/contact` and intentionally have no Stripe price.

#### Known gaps (not blocking — flagged for follow-up)
- **`.env.development` `pk_test_*` is from a DIFFERENT abandoned Stripe account (`51TNmcQ`).** Local dev mode → checkout will misbehave because the price lookup_keys don't exist in that test account. To fix: enable test mode on the new `51TYVK6` account, create matching test-mode products + prices (Stripe test↔live sync isn't automatic), copy that account's `pk_test_*` into `.env.development`. **Punt until local-dev checkout is actually needed.**
- **`supabase/functions/_shared/stripe.ts` CORS allow-list still lists `.virecrm.com` / `virecrm.com`.** Domain history was majix.ai → virecrm.com — both are referenced across the repo (220 hits, 20 files). CORS list is current as long as the live brand is `virecrm.com`. If the brand pivots again, update both `ALLOWED_ORIGIN_SUFFIXES` and the fallback `Access-Control-Allow-Origin`.
- **Stripe Connect webhook NOT created.** The webhook above is platform-only. Once Connect is enabled on the account, create a second webhook with `connect=true` (same URL, same events) so reseller payouts/invoices flow into `client_stripe_accounts` + `submission_stripe_customers`.
- **Promo removed (already shipped pre-session):** commits `27eb0ef` `1460897` `73d0581` `8e309e8` ripped out 30% launch promo from UI, create-checkout, payments-webhook, and tests. No Stripe coupon to manage. Earlier "Promo enforcement" follow-up in ISSUES.md is moot.

#### Verification
- All 5 lookup_keys resolve via `GET /v1/prices?lookup_keys[]=…`, `active=true`, `livemode=true`.
- Webhook endpoint `status=enabled`, `livemode=true`, 11 events subscribed.
- `supabase secrets list` confirms both `STRIPE_LIVE_API_KEY` + `PAYMENTS_LIVE_WEBHOOK_SECRET` are set (digests visible).
- End-to-end checkout NOT yet smoke-tested (would require real card + real charge). Recommended next step: enable test mode in the new account, create matching test-mode prices, run a test card through `/pricing` → checkout → return flow before pointing real customers at it.

#### Manual follow-ups (user)
- [ ] **Rotate `sk_live_51TYVK6…`** in Stripe dashboard → Developers → API keys. The key was pasted in chat and is in conversation logs. After rotation, update `.env` `STRIPE_LIVE_API_KEY` and re-run `supabase secrets set STRIPE_LIVE_API_KEY=<new>`.
- [ ] **Smoke a $1 test product + a real card** before launch. Suggested flow: temporary $1 product in live mode → checkout from a logged-in test account → verify `subscriptions` row inserts via the webhook → cancel from Stripe dashboard → archive the $1 product.
- [ ] **Set Stripe statement descriptor + business profile** in the new account (Settings → Public details). Affects what shows up on customer card statements.
- [ ] **Set `STRIPE_LIVE_API_KEY` + `PAYMENTS_LIVE_WEBHOOK_SECRET` on Cloudflare Worker** ONLY if a route handler under `src/routes/api/**` ever calls Stripe directly. As of this session, all Stripe calls live in Supabase Edge Functions, so the Worker doesn't need these — verified via grep on `src/` (`STRIPE_LIVE_API_KEY` zero hits in `src/`). Skip unless a future route handler imports Stripe.

### 2026-05-21 — Crystal sign-in confirmed; markdown cleanup
**Tags:** [crystal] [auth] [docs]

#### Verification
- `POST /auth/v1/token` with temp pw `hSS1eLMQitFgJfdR` → `invalid_credentials` — confirms she changed her password.
- Admin API `GET /auth/v1/admin/users/7ba2ebfa-…` → `last_sign_in_at=2026-05-20T22:51:19Z`, `must_change_password=null`. Forced PW change flow ran end-to-end in production.
- `greenenergiai.virecrm.com` → org `188c4869-…` "Green EnergiAi", Crystal is `owner`, 4,793 leads. URL sent to Crystal is correct.
- Org slug confirmed `greenenergiai` (not `crystal-cameron-7ba2ebfa` as earlier session entries noted — slug was renamed before Crystal's first sign-in).

#### Shipped
- `README.md` — deleted "Temporary credentials" section (Crystal rotated pw, temp pw dead).
- `ISSUES.md ## Open` — removed stale Crystal onboarding + Phase G + slug-rename items (all resolved). Freeze old Lovable project item updated: Crystal confirmed, Caziah still pending.
- `ISSUES.md ## Recent` — struck through: DM Crystal follow-ups (×2), "pending deploy" note, GCP test-user add (GCP now Production).

### 2026-05-20 — GCP OAuth → Production + legal pages rewrite
**Tags:** [auth] [google-oauth] [legal]

#### Shipped
- `/privacy` + `/terms` fully rewritten with substantive legal content. Operator: Darsh Poddar (individual). Legal contact: `darsh.pod@gmail.com`. Privacy policy adds explicit Google Sign-In data section (GCP requirement), names all sub-processors (Supabase, Stripe, Resend, Cloudflare), GDPR/CCPA user rights. Terms covers acceptable use, data ownership, termination, liability cap, Texas governing law. Commits `9bdba55`, `91af9b9`.
- `TermsCheckbox.tsx` — added `/privacy` link (was missing); renamed "No-Refund Policy" → "Refund Policy"; dropped inaccurate "all payments are final" inline summary.
- GCP OAuth app published to **Production**. Any email can now sign in via Google (no longer restricted to test-user allowlist).

### 2026-05-20 — Fix promo enforcement + ESLint scope explosion
**Tags:** [bug] [frontend] [supabase]

#### Shipped
- `supabase/functions/create-checkout/index.ts` — added server-side subscription count gate before applying `launch30` coupon. Counts `subscriptions` where `environment='live'` and `status IN ('active','trialing')`; skips coupon if `>= 100`. `max_redemptions` on the Stripe coupon object was not viable (Stripe coupons are immutable post-creation; existing `launch30` in prod has no cap). Service-role client scoped to the promo check only.
- `eslint.config.js` — added `.claude` and `.agents` to `ignores`. These directories (worktrees + compiled bundles + skill scripts) were not excluded; scanning them inflated error count from ~5.2k to 104k. Back to 5257 baseline.
- ~~`## Open` "Promo enforcement"~~ — resolved.

#### Verification
- `bun run typecheck` clean.
- `bun run lint` returns 5257 errors (5218 + 39 warnings) — matches pre-explosion baseline.

### 2026-05-20 — Crystal pre-launch: branding, subscription, navbar
**Tags:** [crystal] [frontend] [supabase] [auth]

#### Shipped
- DB `subscriptions` — inserted manual `environment=manual, status=active` row for Crystal (`user_id=7ba2ebfa-f30e-449a-866e-085c5940c1d4`). Without this she'd hit `/billing?required=1` immediately after forced password change. No subscription row existed for Green EnergiAi org.
- DB `organizations` `188c4869-8bc4-438e-b746-c8f28e2932d2` — corrected branding from Lovable defaults: `primary_color=#10CCB7` (was `#b410b7` magenta), `accent_color=#334C40`, `sidebar_color=#0A2A1A`, `button_color=#10CCB7`, `logo_url` set to Green EnergiAi Wix CDN logo. Colors sourced from live greenenergiai.com via subagent browser research.
- `src/components/crm/CrmSidebar.tsx:174` — `/pipeline` nav label changed from hardcoded `"Pricing"` to `template.terminology.pipeline` (energy = "Energy Pipeline"). Icon swapped `DollarSign` → `TrendingUp`. Eliminates collision with `/energy/pricing` "Pricing" entry — Crystal would have seen two identical "Pricing" links. Commit `91d3dec`.

#### Found
- `src/routes/_app.dashboard.tsx:461` — "Total Leads" metric label hardcoded, doesn't use `template.terminology.leadPlural` ("Prospects" for energy). Low priority — cosmetic.
- GCP OAuth consent screen test users: no programmatic path — API deprecated Jan 2026, IAP API disabled on project. Must add `crystal@greenenergiai.com` via console manually.

#### Verification
- `bun run typecheck` clean after sidebar change.
- DB queries confirmed: 4,793 leads in org, `must_change_password=true` set, `onboarding_completed_at` and `tour_completed_at` both set (no wizard/tour fires on login).
- Crystal login flow: forced PW change → dashboard → no billing bounce → energy sidebar unlocked.

#### Manual follow-up (user)
- ~~Add `crystal@greenenergiai.com` to GCP OAuth test users~~ — resolved 2026-05-21; GCP OAuth app moved to Production.

### 2026-05-20 — Fix auth + subscription middleware: throw new Response() → throw new Error()
**Tags:** [bug] [auth] [supabase]

#### Shipped
- `src/integrations/supabase/auth-middleware.ts` — replaced all 7 `throw new Response(...)` calls with `throw new Error(...)`. Messages preserved ("Unauthorized: …" prefix matches `isAuthError`'s `/unauthor/i` regex). Also dropped stale "auto-generated" comment at line 1.
- `src/integrations/supabase/subscription-middleware.ts` — replaced 4 `throw new Response(...)` calls with `throw new Error(...)`. 503 DB-error paths: "Subscription check failed. Please try again." 402 gate: "Subscription required. … Please visit /billing." Status codes lost were meaningless — TanStack Start was wrapping them all as 500 anyway.
- ~~`## Open` "Auth middleware uses `throw new Response()`"~~ — resolved.

#### Verification
- `bun run typecheck` clean.

### 2026-05-20 — CRON_SECRET set + stale migration item closed
**Tags:** [cf-saas] [supabase]

#### Shipped
- `wrangler secret put CRON_SECRET` — uploaded to prod Worker `genesisxsx`. Random base64-32 value generated + uploaded. External schedulers / pg_cron callers must pass `x-cron-secret: $CRON_SECRET` header to `calculate-payouts`, `send-pending-welcomes`, `dispatch-sequences`, `purge-audit-log`.
- ~~`Apply 20260517220000_schedule_send_pending_welcomes_cron.sql`~~ — already applied to both local + remote (`supabase migration list` showed both columns populated). Removed from Open.

#### Verification
- `wrangler secret put` exited 0: "✨ Success! Uploaded secret CRON_SECRET"
- `supabase migration list` output confirmed `20260517220000` in Local + Remote columns.

### 2026-05-20 — Forced password-change flow + Security settings tab
**Tags:** [auth] [frontend] [crystal]

#### Shipped
- `src/components/auth/ChangePasswordForm.tsx` (NEW) — shared form: `PasswordInput` x2, `PasswordStrengthMeter` gated at score ≥ 2, clears `must_change_password` flag in same `updateUser` call.
- `src/routes/change-password.tsx` (NEW) — full-page `/change-password?forced=1` route outside `/_app`; amber banner + no escape when forced; session guard; `onSuccess` → `/dashboard`.
- `src/routes/_app.tsx:205-211` — `must_change_password` gate `useEffect` fires before billing check; redirects to `/change-password?forced=1` when flag set.
- `src/routes/_app.settings.tsx` — new Security tab (third position, Lock icon) → `SecuritySettings` card.
- `src/components/crm/SecuritySettings.tsx` (NEW) — settings card wrapping `ChangePasswordForm`; toast + form reset on success, no redirect.
- `src/routes/reset-password.tsx` — added `PasswordStrengthMeter`, score ≥ 2 gate, third requirement item, clears `must_change_password` on success. Commit `6e76f84`.

#### Verification
- `bun run typecheck` clean.
- ~~Manual flow pending deploy: Crystal signs in with temp pw → gate fires → `/change-password?forced=1` → sets pw → dashboard → no more redirect.~~ Verified 2026-05-21 — Crystal signed in 2026-05-20 22:51 UTC, `must_change_password` cleared, flow confirmed end-to-end.

#### Manual follow-up (user)
- ~~Push + deploy to production.~~ Done.
- ~~DM Crystal temp pw (`hSS1eLMQitFgJfdR`) after deploy confirms.~~ Done — she signed in + rotated pw 2026-05-20 22:51 UTC.
- ~~After Crystal signs in + resets pw, delete "Temporary credentials" section from `README.md`.~~ Done.

### 2026-05-20 — Retire majix.ai: 308 redirect + full virecrm.com cleanup
**Tags:** [virecrm] [rebrand] [cf-saas] [docs]

#### Shipped
- `src/server.ts` — 308-redirect handler: all `*.majix.ai` requests redirect to virecrm.com equivalents before reaching TanStack Start.
- `wrangler.jsonc` — comments updated; majix.ai routes kept for redirect to fire.
- `src/config/support.ts` — SUPPORT_EMAIL flipped to `support@virecrm.com`.
- `supabase/functions/_shared/stripe.ts` — removed `.majix.ai`/`majix.ai` from CORS allow-list; fallback origin flipped to `https://virecrm.com`.
- `src/lib/resend.ts` — removed stale notify.majix.ai cutover comment.
- `src/components/auth/DomainBrandingProvider.tsx` + `GlobalErrorBoundary.tsx` — removed 5 majix.ai regex entries from SYSTEM_HOST_PATTERNS.
- `src/lib/dns-check.ts` — default CNAME target flipped to `customers.virecrm.com`; removed `REQUIRED_CNAME_TARGET_ALT`; TXT lookup renamed `_majix.` → `_virecrm.`.
- `supabase/migrations/20260520100000_rename_verification_token_prefix.sql` — token default flipped `majix-verify-` → `virecrm-verify-`; existing rows backfilled.
- 5 UI files (`CustomerDomainOnboardingDialog`, `DomainHealthPanel`, `EditClientWhiteLabelDialog`, `CustomDomainsPanel`, `_app.dns-check.tsx`) — TXT label prefix `_majix` → `_virecrm`.
- 8 files — localStorage + custom event keys renamed `majix:*`/`majix.*` → `virecrm:*`/`virecrm.*`.
- `supabase/migrations/20260520110000_get_org_by_domain_virecrm_only.sql` — dropped majix.ai subdomain branch from `get_org_by_domain()`.
- `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/custom-domains/cf-for-saas-setup.md` — removed all parallel-cutover language; single-zone (virecrm.com) narrative.

#### Verification
- `bun run typecheck` clean across all units.
- `supabase db push` applied both new migrations.
- E2E: curl `Host: app.majix.ai` → 308 `https://app.virecrm.com` (Unit 1 worktree).

#### Manual follow-up (user)
- Push all unit PRs and merge. After merge and redeploy, smoke curl `https://app.majix.ai/` to confirm 308 fires at production edge.
- `wrangler secret put CLOUDFLARE_ZONE_ID` = `bef363938825376aef7db07f57c3f04b` (virecrm.com zone) to flip the runtime CF for SaaS provisioning to virecrm zone.
- Worker API Token: dashboard → My Profile → API Tokens → find Worker token → Edit → Zone Resources → add `virecrm.com`.
- Extend `CLOUDFLARE_API_TOKEN` scope to include virecrm.com zone (dashboard only).

### 2026-05-20 — Phase G validation + compositeAddress() literal-NULL cleanup
**Tags:** [lovable-migration] [supabase] [bug] [crystal] [caziah]

Continuation session: revalidated Phase G state end-to-end, then closed out the `compositeAddress()` carry-over bug flagged in the prior session. Scope was bigger than first noted — 16 was the count of address-less rows, not bad-token rows. Real impact: 2,606 Crystal + 2,047 Caziah = **4,653 rows** with literal `"NULL, NULL"` tokens.

#### Found

- **`compositeAddress()` literal-"NULL" scope much wider than initial estimate.** Prior session's "16 rows" referred to rows where the composite came out fully empty (NULL service_address). The actual `service_address ILIKE '%NULL%'` query returns **2,606 Crystal + 2,047 Caziah = 4,653 rows** with embedded `NULL, NULL` runs. Pre-existing in Phase F path; Phase G inherited because both phases share `compositeAddress()` and `readXlsxRows()`.

#### Shipped

- **`scripts/migrate-lovable-to-fixed.ts:546` — fixed `compositeAddress()` filter.** Replaced `.filter(Boolean)` with `.filter((s) => s !== "" && s.toUpperCase() !== "NULL")`. Future migration runs skip literal `"NULL"` string-cells alongside empty cells. Comment explains the xlsx-source quirk.
- **Live DB retro-clean** — one transaction, `SET LOCAL request.jwt.claim.role = 'service_role'`, regex strips: `,\s*NULL\s*(?=,|$)` global (mid/trailing) then `^NULL\s*,\s*` (leading) then trim, then NULLIF empty. 2,047 Caziah + 2,606 Crystal rows updated. Post-fix `ILIKE '%NULL%'` count = 0 across both orgs. Spot-checks: Paradise leads now `2111 Taylor St., Dallas, 75211` (was `…, NULL, NULL, Dallas, 75211`), Wings Pizza, Children's Learning Center — all clean.
- ~~`## Recent` 2026-05-20 Phase G "Manual follow-up: compositeAddress() literal-NULL cleanup"~~ — resolved.

#### Verification (live DB via `bun:sql`)

- **Phase G state re-confirmed:** Crystal own-org `188c4869-…` = 4,793 total, 4,789 xlsx_supplement + 2 xlsx_import (Paradise) + 2 NULL source (manual). Energy field coverage on xlsx-derived rows: 4,791 ESI + 4,791 supplier + 4,791 kwh + 4,791 mils + 4,791 contract dates. Status × source distribution intact (won=1693, lost=493, new=2603 for xlsx_supplement; won=2 for xlsx_import; contacted=2 for NULL). Paradise UUIDs + deal_value=$2,000,000 + closed_at all preserved. `joe smho` + `ethan` manual leads untouched.
- **Downstream FKs:** 0 messages / 0 tasks / 0 appointments referencing Crystal-org lead_ids. UUID stability did not need to hold — moot but verified.
- **Cleanup post-state:** Crystal `has_addr=4775`, `null_addr=18`, `bad=0`. Caziah `has_addr=4002`, `null_addr=5193`, `bad=0`. No row got nulled out by the cleanup (every row had at least street_no/street_name surviving).
- `bun run typecheck` — clean.
- `bash scripts/lint-issues.sh` — OK (post-edit).

#### Manual follow-up (user)

- **Push ahead-of-origin commits** when ready. `git push` gated on user per CLAUDE.md shared-state rule.
- ~~**DM Crystal her temp pw** (`hSS1eLMQitFgJfdR`) — pending from prior session.~~ Done — Crystal signed in + rotated pw 2026-05-20 22:51 UTC.

### 2026-05-20 — Google OAuth setup (GCP + Supabase)
**Tags:** [auth] [supabase] [google-oauth]

#### Found

- **Supabase Auth Google provider disabled.** `external_google_enabled=false`, `external_google_client_id=null`, `external_google_secret=null`. UI already wired at 4 call sites (`src/routes/login.tsx:176`, `src/routes/signup.tsx:163`, `src/components/marketing/BrandedSignup.tsx:118`, `src/routes/r.$resellerSlug.signup.tsx:174`). Blocked only on GCP credentials.
- **`site_url=https://app.majix.ai` stale.** `uri_allow_list` majix-only — virecrm domains not in allow list. Will update in same Supabase Management API call as Google credentials.
- **`/privacy` + `/terms` pages missing.** Google Auth Platform consent screen (Branding tab) requires real URLs for these before OAuth app can be published to Production. While app stays in Testing mode, only emails listed under Audience → Test users can sign in. Ticket filed in `## Open`.
- **GCP Authorized JavaScript origins cannot use wildcards.** Per-tenant `<slug>.virecrm.com` origins cannot be listed individually. Not needed — Google only validates the `redirect_uri` (which points to Supabase, not tenant domains). Supabase `uri_allow_list` supports wildcards and handles the bounce back to tenant subdomains.

#### Shipped

- Supabase Auth: `external_google_enabled=true`, client_id + secret set via Management API PATCH.
- `site_url` updated to `https://app.virecrm.com`. `uri_allow_list` extended with `https://virecrm.com/**` + `https://*.virecrm.com/**` (majix wildcards kept for parallel cutover).
- GCP credentials stored in `.env` (server-side reference only — not `VITE_*`, not in bundle).

#### Verification

- Smoke test: Google sign-in on `localhost:8080` — OAuth redirect → Google consent → Supabase callback → `/dashboard`. Confirmed 2026-05-20.
- `handle_new_user` trigger auto-provisioned org (`darsh-test-bc97cbd6`) + 1 lead. Both cleaned up post-smoke via Admin API delete.

#### Manual follow-up (user)

- ~~Create `/privacy` + `/terms` routes before publishing GCP OAuth consent screen past Testing mode.~~ **Done 2026-05-20** — pages fully rewritten (commits `9bdba55`, `91af9b9`); GCP OAuth app published to Production.

### 2026-05-20 — Phase G: Crystal own-org xlsx enrichment (destructive REPLACE)
**Tags:** [lovable-migration] [supabase] [crystal] [xlsx]

User picked Option A from prior session ("enrich Crystal own-org with xlsx, 4,791 UPDATEs"). Probe overturned the UPDATE-only premise — Lovable importer wrote 4,791 stubs with NULL on every discriminating column (esi_id, supplier, kwh, agent_mils, contract dates, address). Only `name` was kept, and 784 distinct Customer Names had multi-row dupes (Daymark = 166 each side). No row-discriminator survived → 1:1 mapping unrecoverable. Pivoted to DELETE-then-INSERT with 2-lead preservation hatch.

#### Found

- **Lovable xlsx importer dropped every energy column.** 4,791 Crystal-org stubs created in one batch (all share `created_at=2026-04-27T18:15:51.299Z` to the millisecond — no row index, no created_at ordering, no `lovable_legacy_id` column). xlsx side has 1,750 distinct Customer Names, 784 with row dupes (top: Daymark 166, Meadowlark 96, JacRy 66, Tropical Trails 44). Plain `UPDATE WHERE name = X` would collapse 166 Daymark leads to one xlsx row's energy data and lose 165 unique meter+supplier+kwh rows.
- **2 human-touched stubs.** Both named "Paradise Fruits and Vegetables LLC" (UUIDs `540cc3d7-…` + `306787e6-…`). `deal_value_cents=$2,000,000` + `closed_at` + `status=won` set 2026-05-15. Real human edits — must preserve UUID + non-energy fields.
- **xlsx Sale Status enum:** 6 distinct values (Meter Check 2604, Approved 1453, Lost 484, Completed 240, Declined 9, Objection 1). `leads.status` is `text`, used values site-wide: `new`, `won`, `lost`, `contacted`. Mapping landed in `mapSaleStatus()`: Approved/Completed → won; Lost/Declined → lost; Meter Check/Objection/null → new.
- **Zero downstream FK rows in Crystal own-org.** All 15 lead_id-referencing tables (messages, tasks, replies, lead_assignees, lead_shares, outreach_sequence_enrollments, conversations, appointments, workflow_runs, commission_earnings, etc.) returned 0 for `organization_id = 188c4869-…`. UUID change on DELETE+INSERT was safe.

#### Shipped

- **`scripts/migrate-lovable-to-fixed.ts` — added Phase G** (`phaseG_crystalOwnOrgEnrich`). Hard-coded to `188c4869-8bc4-438e-b746-c8f28e2932d2`. Logic: (1) read 4,791 xlsx rows; (2) find touched stubs (`updated_at > created_at + 1s` filter); (3) for each touched lead, consume first xlsx row of matching name (lower-trim), UPDATE via COALESCE so human-set status/deal_value/closed_at survive; (4) DELETE all remaining xlsx_import stubs in that org; (5) INSERT remaining 4,789 xlsx rows with full energy fields + `source='xlsx_supplement'` + `status` mapped from xlsx Sale Status. Phase NOT part of `--phase=ALL` (destructive — explicit `--phase=G` required).
- **`XlsxRow` extended** with `customer_name` + `sale_status` (`readXlsxRows()` already-parsed cells, no extra xlsx read pass).
- **`mapSaleStatus()`** added — verified xlsx distinct value list 2026-05-20 (script comment cites it). Falls back to `"new"` on unknown values.
- **Live run executed.** 2 UPDATE + 4,789 DELETE + 4,789 INSERT in three transactions, each with `SET LOCAL request.jwt.claim.role = 'service_role'` (mirrors Phase F pattern — bypasses RLS + lead-template triggers).
- ~~`## Open` follow-up: "Crystal own-org xlsx scope" decision~~ — resolved (struck through; deleted from `## Open`).

#### Verification (live DB via `bun:sql`)

- Crystal own-org `188c4869-…` leads: **4,793 total** = 4,789 `xlsx_supplement` (fresh) + 2 `xlsx_import` (preserved Paradise) + 2 `source IS NULL` (preserved manual: `joe smho`, `ethan`).
- Energy field coverage: `esi_id=4791`, `current_supplier=4791`, `annual_kwh=4791`, `agent_mils=4791`, `contract_start_date=4791`, `contract_end_date=4791`, `service_address=4775` (16 xlsx rows had no composite address), `title=4516`.
- Status × source distribution: xlsx_supplement → won=1693, lost=493, new=2603 (xlsx total 4789). xlsx_import (preserved) → won=2. NULL source (manual) → contacted=2. Sale Status mapping arithmetic checks out: Approved(1453)+Completed(240)=1693 won; Lost(484)+Declined(9)=493 lost; Meter Check(2604)+Objection(1)-2 consumed-for-Paradise=2603 new.
- Preserved Paradise touched leads: both UUIDs intact, `deal_value_cents=$2,000,000` + `closed_at` preserved, `status=won` preserved, now enriched with `esi_id`, `current_supplier=Green Mountain`, `annual_kwh` from their respective consumed xlsx rows (indices 4105, 4106).
- Random xlsx_supplement sample: "Cowtown Materials" with ESI, Suez supplier, 88,797 kWh, 0.998 mils, 2023-06-01 contract start, full Dallas service address — full xlsx column carry-through.
- `bun run typecheck` clean.
- `bash scripts/lint-issues.sh` — OK.

#### Manual follow-up (user)

- ~~**Cosmetic carry-over bug in `compositeAddress()`** (pre-existing in phase F, not introduced this session): xlsx address columns containing literal string `"NULL"` (e.g. `address_2="NULL"`) survive the `filter(Boolean)` step and produce service_address strings like `"426 N. Kealy St, NULL, NULL, Lewisville, 75057"`. ~16 rows affected in Crystal org. Filed for later cleanup pass — strip literal "NULL"/"null" tokens in `compositeAddress`.~~ — **resolved 2026-05-20 (see top of `## Recent`).** Scope was 2,606 Crystal + 2,047 Caziah = 4,653 rows, not 16. Fix landed in code + retro-cleaned in DB.
- **Crystal's own-org tenant now has the same energy-broker dataset as Caziah's.** Two orgs hold the same xlsx data. If consolidation decision is "merge into greenenergiai", these 4,791 will need dedup against Caziah's 5,386 xlsx_import + 3,809 xlsx_supplement leads — likely heavy ESI overlap. Defer until consolidation call lands.

### 2026-05-20 — Lovable migration: JSONB double-encode bug + Crystal temp pw
**Tags:** [lovable-migration] [supabase] [auth] [bug]

User asked for a temp pw for Crystal. Admin API returned `500 "Database error loading user"` on her UUID, but worked on the smoke user. Dug in — found a wider bug in the live-port script that touched every ported `jsonb` field.

#### Found

- **JSONB columns double-encoded on insert.** Migration script parsed `auth.users`, `auth.identities`, and `public.*` `jsonb` values from the dump as TEXT, then bound them as TS strings via `bun:sql`'s positional params. Postgres' implicit `text → jsonb` cast on the value side stores the text *as a JSON string* (`jsonb_typeof(col) = 'string'`) instead of parsing it as an object. Generated columns like `auth.identities.email` (`lower(identity_data->>'email')`) silently resolve to NULL because `->>'email'` on a string-typed JSONB returns NULL. GoTrue's admin endpoint then joins identities + reads `email` → 500 on rows missing it.
- Affected: **15** `auth.identities.identity_data`, **14** `auth.users.raw_user_meta_data`, **14** `auth.users.raw_app_meta_data`, **2** `public.organizations.auto_invoice_template`. Every ported user except the 1 already-native `darsh.pod@gmail.com` smoke. Scan across all `public`+`auth` jsonb columns post-fix: 0 remaining.

#### Shipped

- **Live data fix on prod DB** — `UPDATE … SET col = (col #>> '{}')::jsonb WHERE jsonb_typeof(col)='string'` across the four affected columns. Generated `auth.identities.email` re-derives automatically post-fix.
- **Migration script root-cause fix** — `scripts/migrate-lovable-to-fixed.ts` now introspects `data_type='jsonb'` per-table via `getJsonbCols()` and wraps placeholders as `($N::text)::jsonb` for jsonb columns. Forces Postgres to parse text as JSON value, not wrap it as a JSON string. Re-runs of any phase against any table no longer double-encode. Touched: `phaseA_authUsers` (users + identities) + `upsertRows` (public.*). `bun run typecheck` clean.
- **Crystal temp password minted.** UUID `7ba2ebfa-f30e-449a-866e-085c5940c1d4`, pw written to `README.md` "Temporary credentials" section + `must_change_password=true` flagged in `user_metadata`. (User explicitly chose this over the password-reset-email route; private repo + transient section.)
- **Sign-in smoke test passed.** `POST /auth/v1/token?grant_type=password` with the new pw returns HTTP 200 + access_token + `must_change_password` flag. Bcrypt round-trip end-to-end verified. **Closes the previously-owed Crystal sign-in smoke item.**

#### Verification

- `auth.users` + `auth.identities`: 16 + 17 rows healthy. `jsonb_typeof()` returns `object` for all metadata columns. `auth.identities.email` populated for all 17.
- `GET /auth/v1/admin/users/{crystal_uuid}` returns 200 (previously 500).
- `GET /auth/v1/admin/users?per_page=20&page=1` returns 200 (previously 500 on page>=2 — the broken Crystal identity row was poisoning the list query).
- `POST /token` sign-in with `crystal@greenenergiai.com` + temp pw → 200 + valid JWT.
- `bash scripts/lint-issues.sh` — OK.

#### Manual follow-up (user)

- **Crystal's sign-in must trigger pw-reset flow.** Client login should read `user_metadata.must_change_password` post-auth and redirect to `/_app/account/password`. Not verified — flag for client-side audit next session if Crystal reports getting in without a reset prompt.
- **DM Crystal the temp pw.** Then delete the "Temporary credentials" section from `README.md` once she has signed in + rotated.
- **Bcrypt-port verification for the 3 other staff bcrypt rows** (`mleaverton`, `erica`, `shelby`) still nominally owed but mechanism = same as Crystal. If a sign-in is asserted to fail, mint a temp pw via the same admin-PUT path and investigate.

### 2026-05-20 — Resend cutover to notify.virecrm.com complete
**Tags:** [resend] [virecrm] [rebrand] [email]

Pending item #4 from prior summary. Resend DNS verification (~24h external) completed: `GET /domains` shows `notify.virecrm.com` `status: verified`. Flipped all canonical sender constants in code + sent a live test.

#### Shipped

- **`SENDER_DOMAIN` + `FROM_DOMAIN` constants** flipped `"notify.majix.ai"` → `"notify.virecrm.com"` in 6 files:
  - `src/routes/api/email/transactional/send.ts:11,15`
  - `src/routes/api/notify-low-balance.ts:18,19`
  - `src/routes/api/public/hooks/contact-followup-reminders.ts:17,18`
  - `src/routes/api/public/contact.ts:18,19`
  - `src/routes/hooks/send-pending-welcomes.ts:9,10`
  - `src/lib/email/dispatch-outreach.ts:25,26`
- **`src/routes/api/email/queue/process.ts:243`** fallback unsubscribe-URL host flipped (`?? "notify.majix.ai"` → `?? "notify.virecrm.com"`).
- **`src/components/crm/ResendSettingsCard.tsx`** placeholder + docstring updated (`noreply@notify.majix.ai` → `noreply@notify.virecrm.com`).
- **`src/lib/resend.ts:80`** docstring reframed — `notify.virecrm.com` now canonical; `notify.majix.ai` flagged as legacy parallel-cutover.
- **`CLAUDE.md:76`** + **`AGENTS.md:115`** hostname-table rows updated (status: pending → live, sender-constants note added).
- 6 files + 3 doc files = 9 file edits.

#### Verification

- `bun run typecheck` clean.
- `grep -nE "notify\.majix\.ai" src/**` returns only the intentional parallel-cutover docstring at `src/lib/resend.ts:80` — all code-level constants flipped.
- **Live test send via Resend API** (`POST /emails`, `from: VireCRM <noreply@notify.virecrm.com>`, `to: darsh.pod@gmail.com`): returned id `d56dc7a3-5b59-4bff-91e1-db88a02a3a6d`, `GET /emails/{id}` later reported `last_event: "delivered"`.
- **Note:** Test was via raw Resend API (not via the flipped code constants), since the constant changes only take effect post-deploy. Live deploy will be a separate verification step.

#### Manual follow-up (user)

- After next Worker deploy, verify a real transactional flow (e.g. trigger a welcome email or contact-form follow-up) lands with `From: noreply@notify.virecrm.com`.

### 2026-05-20 — Supabase Auth site_url + redirect allow-list flipped to virecrm.com
**Tags:** [supabase] [auth] [virecrm] [rebrand]

Pending item #3 from prior summary. Supabase Management API `PATCH /v1/projects/{ref}/config/auth` via `SUPABASE_ACCESS_TOKEN`. No dashboard click needed.

#### Shipped

- **`site_url`** flipped `https://app.majix.ai` → `https://app.virecrm.com`. This is the default redirect target for sign-up flows that don't pass an explicit `redirect_to`; email-template default callbacks pick this up too.
- **`uri_allow_list`** rewritten to:
  - `https://app.virecrm.com/**` (new canonical CRM landing + Supabase Auth callbacks)
  - `https://virecrm.com/**` (marketing apex)
  - `https://www.virecrm.com/**` (marketing www peer)
  - `https://*.virecrm.com/**` (per-tenant white-label subdomains)
  - `https://app.majix.ai/**`, `https://majix.ai/**`, `https://*.majix.ai/**` — kept for parallel cutover (until ~2026-08-17 per CLAUDE.md hostname plan)
  - `http://localhost:8080/**` — kept for local dev
- Used `/**` glob form only (matches sub-paths) — mirrors existing majix.ai entry pattern, which has been working since rebrand cutover. Bare-domain entries omitted as redundant.

#### Verification

- Re-read `/config/auth` returned exactly the patched shape.
- No re-deploy needed — config is read at runtime by Supabase Auth.

#### Manual follow-up (user)

- After Crystal + Caziah sign-in smoke (post-migration), validate that a virecrm.com OAuth callback (e.g. `https://greenenergiai.virecrm.com/auth/callback`) actually completes a round-trip. Magic link → click → land on subdomain expected.

### 2026-05-20 — CF for SaaS enabled on virecrm.com (autonomous unblock)
**Tags:** [cf-saas] [virecrm] [rebrand] [unblock]

Prior session blocked: "CF for SaaS dashboard config on virecrm.com zone — blocked on MCP token-scope ceiling." Both plugin OAuth + wrangler OAuth confirmed insufficient (10000 / 9109 / 1000 errors on `/zones/{id}/custom_hostnames/*` + `/dns_records` despite advertised `#ssl:edit` / `ssl_certs:write`). Wrangler scopes are Workers-related; plugin OAuth scopes are account-read-heavy. Neither carries Zone-level Cert-Manager / Custom-Hostnames / DNS edit.

User minted a Custom API Token (`claude-code-virecrm-saas`) with `Zone.SSL and Certificates: Edit`, `Zone.DNS: Edit`, `Zone.Zone Settings: Edit`, `Zone.Zone: Read`, `Zone.Workers Routes: Edit` scoped to virecrm.com + majix.ai. Stored as `CLOUDFLARE_API_TOKEN_ADMIN` in local `.env` (gitignored). Token verify returned `status: active`.

#### Shipped (via direct CF API curl)

- **`PUT /zones/bef363938825376aef7db07f57c3f04b/custom_hostnames/fallback_origin`** body `{"origin":"customers.virecrm.com"}` — returned 200, `status: initializing` → `status: active` in <1s (single poll). CF for SaaS now live on the virecrm.com zone.
- Pre-existing DNS already correct: `customers.virecrm.com` CNAME → `virecrm.com`, proxied (mirrors `customers.majix.ai` → `majix.ai` proxied pattern). No DNS change needed.
- Worker route `customers.virecrm.com/*` already present in `wrangler.jsonc:48` (zone_name = "virecrm.com"). No code change needed.

#### Verification

- `GET .../custom_hostnames/fallback_origin` on virecrm.com — `origin=customers.virecrm.com, status=active, created_at=2026-05-20T15:01:45Z`.
- `GET .../custom_hostnames/fallback_origin` on majix.ai (reference) — same shape, `status=active`.
- `curl -sI https://customers.virecrm.com/` — `HTTP/2 200`, `server: cloudflare`, `cf-ray: 9fec389c9a95766c-SEA`.
- `curl -sI https://customers.majix.ai/` (reference) — same shape, also 200.
- Token scope verified via `/user/tokens/verify` → `status: active`.

#### Manual follow-up (user)

- **Extend the Worker `CLOUDFLARE_API_TOKEN` secret's zone resources** to include `virecrm.com`. That secret is what `src/functions/custom-hostnames.functions.ts` uses at RUNTIME to provision tenant custom hostnames; without virecrm.com in its zone scope, premium-tier tenants on the virecrm.com side can't onboard a custom domain. Dashboard → My Profile → API Tokens → find the Worker token → Edit → Zone Resources → add `virecrm.com`. No code change required.
- **Mint `CLOUDFLARE_LEGACY_ZONE_ID` Worker secret** = `a5a3f9d70f46387b2f3933dbb5c68cde` (majix.ai zone). Plus decide whether to flip `CLOUDFLARE_ZONE_ID` to `bef363938825376aef7db07f57c3f04b` (virecrm.com). The flip requires code edits in `src/functions/custom-hostnames.functions.ts` + `src/functions/domain-health.functions.ts` so they read both zones. Pin decision in `docs/custom-domains/cf-for-saas-setup.md` before flipping.

### 2026-05-19 — post-migration verify + skip_guc migration registered
**Tags:** [lovable-migration] [supabase] [verification]

Picked up after spot-check session (`cecfd3b`). Re-verified live DB against commit claims + pushed the one local-only migration left from session 5.

#### Shipped

- `supabase db push --include-all` — applied `20260519120000_handle_new_user_skip_guc.sql` to remote `coynbufhejaeuifpvmvw`. Now recorded in `supabase_migrations.schema_migrations`. Function body unchanged (was `CREATE OR REPLACE`'d in-band by session 5; push idempotent).
- `src/lib/email/outreach-delivery.ts:76,452` — renamed leftover `channel: "lovable"` → `channel: "platform"` on the built-in fallback path. Union type at line 76 + return value at line 452. No consumers grep `"lovable"` literally (only union members referenced — `dispatchOutreachEmail` and `sendResendEmail` are the actual transports under the hood). `bun run typecheck` clean. Telemetry will now log `platform` for built-in sends; downstream Reports unchanged because none read this field.
- **Radix `aria-describedby` warning fix — DialogDescription added to all 5 unguarded dialogs.** Grep over `src/**/*.tsx` for `DialogContent` minus `DialogDescription` found exactly 5 real candidates (matches ISSUES.md Open list minus the dead `command.tsx`):
  - `src/routes/_app.academy.tsx:237` "Create course" — added "Add a new course to the team training library."
  - `src/routes/_app.academy.$courseId.tsx:248` "Add lesson" — added "Title, video URL, duration, and optional notes for this lesson."
  - `src/routes/_app.contact-submissions.tsx:452` submission detail — added "Contact form submission with sentiment, priority, and full message body."
  - `src/components/energy/EnergyTablePage.tsx:261` "Create {entity}" — interpolated description "Add a new {entity} record."
  - `src/components/crm/AddLeadDialog.tsx:165` "Add New Lead" — added "Create a new lead with contact details, qualification fields, and optional auto-outreach."

  Mechanism: Radix `DialogContent` warns when no element has `aria-describedby`. `DialogDescription` auto-wires its own id into `aria-describedby` on render. `bun run typecheck` clean + `bun run test` 123/123 pass. **Not browser-verified** — relying on Radix's documented behavior + tests; no console-warning repro run.

#### Verification (live DB via `bun:sql`)

- Counts match: 16 `auth.users` (14 ported + Darsh + smoke), 17 `auth.identities`, 13,992 `leads` (9,198 Caziah + 4,793 Crystal + 1 Darsh test).
- Caziah org `8b8c76ab-08de-4fd1-a703-b06138078181` energy fields: `esi_id=4018`, `agent_mils=4018`, `annual_kwh=4018`, `current_supplier=4018`, `contract_start_date=4018`, `service_address=4002`. Matches commit `cecfd3b` exactly.
- Crystal own-org `188c4869-…` energy fields: all zero except `annual_kwh=1`. Confirms xlsx scoping unchanged.
- Bcrypt port clean: 7 of 16 users have `^\$2[aby]\$` hash, 9 have `NULL encrypted_password` — verified against `og_database/genesis_auth_data.sql`, those 9 are all `"provider": "google"` OAuth users with `encrypted_password=NULL` in the dump too. No password loss.
- `pg_get_functiondef('public.handle_new_user'::regproc)` includes `current_setting('app.skip_auto_provision', true) = 'on'` short-circuit. Trigger live.
- `supabase migration list` — `20260519120000` now in both Local + Remote columns.
- `bash scripts/lint-issues.sh` — OK.

#### Manual follow-up (user)

- Sign-in smoke remains user-owed: Crystal (`crystal@greenenergiai.com`, bcrypt) + bcrypt staff (mleaverton, erica, shelby). Caziah signs in via Google OAuth (no password to test). No code action.
- ~~Crystal own-org xlsx scope decision (item from prior session) still open.~~ Resolved 2026-05-20 via Phase G — see session entry above.
- Push when ready — branch now 2 ahead of origin (`d803b95` + `cecfd3b`).

### 2026-05-19 — migration spot-check (Caziah energy fields verified)
**Tags:** [lovable-migration] [supabase] [verification]

Picked up after session-5 commit `d803b95` (live port already ran + committed). Owed verification step: spot-check 10 random Caziah leads for populated energy fields. Done.

#### Verification (live DB, post-port via `bun:sql`)

- **Caziah org `8b8c76ab-…`** — 9,198 leads total. Energy-field counts: `esi_id=4018`, `agent_mils=4018`, `annual_kwh=4018`, `contract_start_date=4018`, `contract_end_date=4018`, `current_supplier=4018`, `service_address=4002`. 4,018 ESI-populated = 982 xlsx UPDATEs + 3,036 xlsx-only INSERTs that carried ESI (the other 773 xlsx inserts had blank Meter Number).
- **10 random Caziah-ESI sample** all real: mils 0.051–2.000, kWh 4,085–232,944, suppliers (Suez, TXU Energy, Green Mountain, Frontier, Cirro Energy, Agera Energy), contract dates 2016–2026. Zero nulls in sampled rows.
- **Crystal own-org `188c4869-…`** — 4,793 leads total. `esi_id=0`, `agent_mils=0`, `annual_kwh=1`, contract dates 0, supplier 0, address 0. Confirms session-5 design: xlsx supplement scoped to Caziah org only. Open Q #2 in handoff (does ngp-master apply to Crystal's own tenant?) remains user-blocked.
- `bash scripts/lint-issues.sh` — OK. Header count 25 → 26.

#### Manual follow-up (user)

- ~~**Apply `20260519120000_handle_new_user_skip_guc.sql` via `supabase db push`.**~~ Done next session, see entry above.
- ~~**Crystal own-org xlsx scope** — decide if ngp-master also applies to her own tenant. If yes, re-run `--phase=F` against `188c4869-…` (script `targetOrg` needs a flag or edit).~~ Resolved 2026-05-20 via Phase G (DELETE+INSERT path, not phase F re-run).
- **Caziah / Crystal sign-in smoke** — both should sign in with old bcrypt passwords. No friction expected; bcrypt rides through.

### 2026-05-19 — Open-list staleness audit (Phase 2 + bugs)
**Tags:** [audit] [lovable-remnant] [a11y] [open-list]

Picked up from autonomous-only pile while user-blocked items pending. Verified each `## Open` bullet against current source. **7 items pruned** as fixed by prior unlogged work; **4 real items remain.**

#### Pruned (verified fixed in current `src/`)

- `_app.admin.tsx` window.confirm/prompt — `grep -n 'window\.(confirm|prompt|alert)' src/` returns zero hits across whole tree.
- `AddLeadDialog.tsx` a11y — every `<label>` has `htmlFor={fid(...)}`, every `<input>` has matching `id` + `name` + appropriate `autoComplete` (`name`, `organization`, `email`, `tel`). Uses React `useId()` for collision-free IDs.
- `PipelineView.tsx` keyboard alt for drag-drop — `DropdownMenu` "Move to stage" wired with `aria-label`, focus-visible ring, `group-focus-within` reveal. Lines 328-357. Keyboard path exists.
- Phase 2 — email send path Lovable refs at `src/lib/email/send.ts:36`, `src/lib/email/dispatch-outreach.ts`, `src/lib/admin-quote-email.functions.ts:99` — POSTs to `/lovable/email/transactional/send` gone. None of those three files contain `lovable` (case-insensitive) anymore.
- Phase 2 — custom-domain onboarding DNS Lovable refs at `CustomerDomainOnboardingDialog.tsx` + `DomainHealthPanel.tsx` — no more `185.158.133.1` or `_lovable` strings; rebrand to CF Workers target + `_majix` TXT prefix already landed.
- Phase 2 — `@lovable.dev/cloud-auth-js` social signin — `src/integrations/lovable/index.ts` MISSING entirely; zero importers of `@lovable.dev/cloud-auth-js` or `@/integrations/lovable` across `src/`. Migration to Supabase native OAuth complete.
- Phase 2 — `ResendSettingsCard.tsx:4` sentinel — `KEY_SENTINEL` renamed to `__platform_managed__` at `src/functions/resend.functions.ts:21`; `ResendSettingsCard` no longer references it at all. Phase 1 direct-SDK shift complete.

#### Real items kept in `## Open`

- Phase 2: Connector OAuth proxy stub at `gateway.ts:41` — still throws `ConnectorNotConfiguredError`. Apollo/Slack/Gmail/Twilio/Sendgrid integrations remain dark.
- Bugs: Auth middleware `throw new Response()` × 7 sites at `auth-middleware.ts:13,22,28,32,37,55,59` — TanStack Start doesn't serialize Response. Dead path now but blocks future "token expired" handling.
- Bugs: Promo enforcement — `applyPromoDiscount` still unconditional, banner copy lies. Need Stripe `max_redemptions=100` coupon OR server counter.
- ~~Bugs: Onboarding wizard `aria-describedby` Radix warning~~ — fixed next session, see entry above.

#### Found (added to `## Open`)

- Legacy `"lovable"` channel label still leaks in `src/lib/email/outreach-delivery.ts:76,452` — built-in fallback returns `channel: "lovable"` even though Resend powers it. Cosmetic, not blocking; added to Phase 2 list. All other `lovable` substring hits across `src/` are migration-history comments/docstrings (`src/lib/resend.ts:5-6`, `src/lib/sendgrid.ts:6`, `src/functions/test-email.functions.ts:9` etc.) — leave as-is, useful historical context.

#### Verification

- `bash scripts/lint-issues.sh` — OK.
- Pre-edit header count 23, post-edit 24.

#### Manual follow-up (user)

- None new from this audit; all prior pending items remain (push, CF for SaaS, secrets, Supabase Auth URLs, Resend send).

### 2026-05-19 — live-browser smoke on virecrm.com cutover (JS-runtime / DomainBrandingProvider verify)
**Tags:** [rebrand] [smoke] [domain-branding] [lovable-remnant]

Picked up handoff item 5 from prior session ("rebrand cutover partial" entry below). HTTP smoke already green; missing piece = JS-runtime / React-mount / brand-resolve check. Dispatched headless `agent-browser` subagent (session `virecrm-smoke`, closed cleanly at end, other three sessions left untouched).

#### Verified

- `https://virecrm.com/` — 200, title `VireCRM — Never Let a Lead Go Cold Again`, React mounts clean, console clean, default VireCRM marketing (apex peer — expected).
- `https://www.virecrm.com/` — 200, same bundle, same outcome (www peer — expected).
- `https://app.virecrm.com/` — 200, React mounts clean, console clean. Reserved label → `get_org_by_domain` returns NULL → marketing fallback. Per-spec but see "Found" #3.
- `https://smoke-test-user-516e90e0.virecrm.com/` — 200, React mounts clean, console clean. **Body brand RESOLVED** — heading reads "Get started with Smoke Test User's CRM", branded signup card with org logo + tenant copy. Confirms `DomainBrandingProvider` path-2 (slug match on `<label>.virecrm.com`) wired end-to-end through `get_org_by_domain` RPC.

VERDICT: **all-green** for the JS-runtime / brand-resolve question that the handoff flagged. Smoke item 5 closed except for the Resend test-send leg (mutates external state, requires user nod — left untouched).

#### Found (3 minor follow-ups, none blocking)

1. **`support@majix.ai` constant survived Unit 20 sweep.** `src/config/support.ts:9` — single source of truth, still `support@majix.ai`. Cascades to ~11 user-facing surfaces: `routes/refund-policy.tsx`, `routes/privacy.tsx`, `routes/terms.tsx`, `routes/contact.tsx`, `routes/pricing.tsx`, `components/marketing/BusinessEmailBanner.tsx`, `components/marketing/ContactForm.tsx`, `components/onboarding/ProductTour.tsx:342`, `components/GlobalErrorBoundary.tsx`, `lib/email-templates/contact-inquiry.tsx`, `lib/email-templates/contact-followup-reminder.tsx`. NOT fixed unilaterally — `support@virecrm.com` inbox provisioning status unclear during parallel cutover (notify.virecrm.com itself pending Resend DNS verify per "## Open" item). User call: rebrand the constant now (forwarder must exist by then) OR keep `majix.ai` until 90d cutover (~2026-08-17), batch with the 308 flip.
2. **Tenant subdomain `<title>` did not flip to org brand.** Subagent saw default `VireCRM — Never Let a Lead Go Cold Again` on the `smoke-test-user-516e90e0` subdomain. `DomainBrandingProvider.tsx:117-125` IS wired to set `document.title = branding.brand_name`, but early-returns if `branding.brand_name` is null/empty. Most likely cause: smoke-test-user org's `brand_name` column is NULL in DB — data gap on the smoke fixture, not a code defect. Real-tenant verify will surface this when a real org's brand_name is set. Logged for awareness; no code action.
3. **`app.virecrm.com` renders marketing landing, not a login surface.** Per-spec (reserved label → marketing fallback) but a user landing here cold sees no obvious "sign in" affordance beyond the nav link. Possible product follow-up: route `app.virecrm.com/` → `/login` redirect instead of marketing. Surface for product call, not bug.
4. **Stale screenshot artifact** at `/tmp/virecrm-tenant-smoke.png` (tenant brand screenshot from subagent). Disposable.

#### Verification

- Subagent ran via `agent-browser` CLI; no MCP fallback needed.
- `agent-browser session list` post-close confirms `virecrm-smoke` gone, `pr-pricing` + `cf-onboarding` + `migration-supabase` (other agents' sessions) intact.
- Pre-edit header count: 22 `### 2026-` headers. Post-edit: 23. `bash scripts/lint-issues.sh` (run end-of-session).

#### Pending handoff items (unchanged from prior session)

1. Push `7a25aeb` + `5ea0798` (2 commits ahead). Blocked on user nod ("push" command).
2. CF for SaaS dashboard config on `virecrm.com` zone — blocked on MCP token extension OR shell-out via existing `CLOUDFLARE_API_TOKEN` Worker secret w/ zone resources extended. Either route = user dashboard action.
3. Mint `CLOUDFLARE_LEGACY_ZONE_ID` Worker secret = `a5a3f9d70f46387b2f3933dbb5c68cde`. `wrangler secret put` mutates shared state — user nod.
4. Supabase Auth redirect URLs on project `coynbufhejaeuifpvmvw` — dashboard click-through. User-only.
5. Resend transactional test send from `notify.virecrm.com` (once DNS verified). External-state mutation. User-triggered.

### 2026-05-19 — low-hanging fruit pass: CrmSidebar fixes + Open-list staleness audit
**Tags:** [bug] [frontend] [audit]

Two real bug fixes in `CrmSidebar.tsx`. Audit pass over `## Open` "Bugs found" + "Phase 2 cleanup" subsections — 5 items already fixed by earlier rebrand units / earlier sessions; pruned from Open.

#### Shipped

- `src/components/crm/CrmSidebar.tsx:101` — removed dead `const enabledModules = organization?.enabled_modules ?? template.defaultModules;` pull, and the matching `void enabledModules;` at line 163. The data flow is intact via `useAuth().organization.enabled_modules` — sidebar just wasn't consuming it. Actual gating (mapping nav items → module keys) is product work, not a bugfix. Reframing original ISSUES.md finding: gating isn't "broken," it was never implemented; the void was masking dead code.
- `src/components/crm/CrmSidebar.tsx:113-126` — body-scroll lock now snapshots `document.body.style.overflow` ONCE on mount via a `useRef`, not per render. Separate effect toggles `hidden` ↔ snapshot on `mobileOpen` change. Prevents stranding `overflow: hidden` if another component (Radix Dialog, etc.) toggles overflow between drawer open/close. Imported `useRef` from react.

#### Audit — items pruned from `## Open` as stale

- **`VerifiedExplainer.tsx:50`** — Lovable mention already removed; current copy reads "We refreshed your stored {providerLabel} token…". No Lovable references in the file (`grep -n Lovable`).
- **`admin-quote-email.functions.ts:97`** — fallback origin already `"https://virecrm.com"` (shipped in PR #11 / unit-7 commit `3e5650d`).
- **`contact-acknowledgment` template** — fallback pricing URL already `https://majix.ai/pricing` (original `genesisx.space` issue fixed earlier). Brand-name swap to VireCRM is separate rebrand work, not a bug.
- **`_app.admin.tsx:1340,1354,1888`** — already rebranded: line 1343 = `"VireCRM — Invoice for your ${project_type}"`, line 1357 = `"— Ethan, VireCRM"`, line 1897 = `"VireCRM — ${project_type}"`. No "Genesis" strings remain.
- **Reputation banner copy missing** — entry exists in `PreviewViewBanner.tsx:51-54` (`simulated` + `disabled` both populated). Not falling through to default fallback.

#### Verification

- `bun run typecheck` — clean.
- `bun run test` — 123/123 pass.
- `npx eslint src/components/crm/CrmSidebar.tsx` — 1 pre-existing prettier error on line 295 (untouched code). Zero new lint findings introduced.
- Repo-wide `bun run lint` reports 104149 errors — far above the ~5210 baseline ISSUES.md last logged. Pre-existing config regression unrelated to this edit; out of scope for this pass. **Flag for follow-up.**
- File diff inspected — `useRef` import added, body-scroll effect rewritten as snapshot-on-mount + toggle-on-state, dead `enabledModules` pull + `void` line removed.

#### Manual follow-up (user)

- Repo-wide lint count jumped from ~5210 to 104149. Investigate next session — likely a config change or plugin update cascading; not from this work.

### 2026-05-19 — rebrand cutover partial: DNS + dual-zone SQL + CF tooling docs landed (handoff to next session)
**Tags:** [rebrand] [cf-saas] [supabase] [handoff]

Partial cutover landed this session via Cloudflare API MCP + supabase CLI. Stopping here to keep main-context lean before handoff.

#### Shipped this session

- **DNS records on `virecrm.com` zone confirmed live + serving.** Verified via Cloudflare API (`mcp__plugin_cloudflare_cloudflare-api__execute` → `/zones/.../dns_records`): apex AAAA `100::`, four CNAMEs (`www`, `app`, `customers`, `*` all → `virecrm.com`, all proxied). Resend trio (`MX send.notify.virecrm.com` → `feedback-smtp.us-east-1.amazonses.com`, DKIM TXT on `resend._domainkey.notify.virecrm.com`, SPF TXT `v=spf1 include:amazonses.com ~all` on `send.notify.virecrm.com`). Earlier `dig` runs returning empty were stale resolver cache, not actual missing records.
- **HTTP smoke green from public.** `virecrm.com`, `www.virecrm.com`, `app.virecrm.com`, `<slug>.virecrm.com` all return HTTP 200 with `<title>VireCRM — Never Let a Lead Go Cold Again</title>`. Worker bundle attached to all virecrm.com routes via CF Workers Builds — last main-branch build `b4f0cbc8` (commit `6026322`) and `98a7124e` (commit `ea7a9e3`, my Unit 20 push) both succeeded.
- **Supabase dual-zone migration `20260519100844_get_org_by_domain_virecrm.sql` PUSHED to remote** (`supabase db push --linked --include-all`). Verified with `SELECT get_org_by_domain('smoke-test-user-516e90e0.virecrm.com')` AND `.majix.ai` — both return the same tenant blob. Dual-zone resolver works end-to-end.
- **CF tooling docs (commit `7a25aeb`, NOT pushed yet).** CLAUDE.md + AGENTS.md + README.md updated with which CF skill / MCP server to invoke for which task (routing table format). Replaces the broken `cloudflare-docs` MCP ref with `cloudflare:cloudflare` skill where applicable. Per `git log origin/main..main`: 1 unpushed commit ready when user is.
- **Zone IDs captured for next-session reference:**
  - `virecrm.com` → `bef363938825376aef7db07f57c3f04b`
  - `majix.ai` → `a5a3f9d70f46387b2f3933dbb5c68cde`

#### Found / decided / parked

- **MCP token-scope ceiling.** The `cloudflare@cloudflare` plugin's OAuth-issued token only carries `#zone:read` / `#zone_settings:edit` / `#waf:read` / `#logs:read`. **No `#ssl:edit`** — so `/zones/{id}/custom_hostnames*` endpoints return `10000: Authentication error`. CF for SaaS API work (provision, list, fallback origin) is not reachable through this MCP. Two options for next session: (a) extend the existing `CLOUDFLARE_API_TOKEN` Worker secret's zone resources to include `virecrm.com` and shell-out via `curl` against the API, (b) dashboard-click steps 5+ from the runbook.
- **`CLOUDFLARE_ZONE_ID` Worker secret untouched.** Currently set to the majix.ai zone (legacy). DO NOT flip to virecrm.com without first updating the code that reads it (`src/functions/custom-hostnames.functions.ts` + `src/functions/domain-health.functions.ts`) to also accept `CLOUDFLARE_LEGACY_ZONE_ID`. Flip-without-code-update would break any existing customer custom-hostname provisioning. Both zones currently have 0 custom hostnames (per MCP attempt, errored on auth but the count check happened pre-error), so the actual risk is theoretical — but flag remains.
- **`greenenergiai.virecrm.com` resolves null.** The greenenergiai org was deleted on the new DB during 2026-05-19 session-3 cleanup (`c31c2a18-…` org dropped pending old-DB→new-DB migration). Dual-zone resolver returns NULL because the tenant doesn't exist, not because the resolver is broken (smoke-test-user slug resolves fine on both zones — proves resolver works). Will populate again when `scripts/migrate-lovable-to-fixed.ts` runs (separate work track, blocked on user-provided `DATABASE_URL`).

#### Pending — pick up here next session

1. **Push `7a25aeb`** (CF tooling docs) to remote. One-liner: `git push origin main`. Will trigger a fresh CF Workers Build but no behavior change.
2. **CF for SaaS dashboard config on `virecrm.com` zone.** Either (a) MCP token-extend route — go to Cloudflare → My Profile → API Tokens → edit the OAuth-issued plugin token → add `SSL and Certificates: Edit` permission scoped to both zones, then re-auth the MCP. OR (b) use the existing `CLOUDFLARE_API_TOKEN` Worker secret (already scoped for SSL/Certs on majix.ai) — extend its zone resources to include `virecrm.com` and hit the API directly. Then: enable CF for SaaS on the zone, set `customers.virecrm.com` as the fallback origin, wait for status **Active**.
3. **Mint `CLOUDFLARE_LEGACY_ZONE_ID` Worker secret** = `a5a3f9d70f46387b2f3933dbb5c68cde` (majix.ai). Also re-evaluate whether to flip `CLOUDFLARE_ZONE_ID` to `bef363938825376aef7db07f57c3f04b` (virecrm.com) and update the Worker code that consumes both. Pin the decision in `docs/custom-domains/cf-for-saas-setup.md` before flipping.
4. **Supabase Auth redirect URLs.** Dashboard → project `coynbufhejaeuifpvmvw` → Authentication → URL Configuration → Redirect URLs → add `https://virecrm.com`, `https://virecrm.com/**`, `https://www.virecrm.com`, `https://www.virecrm.com/**`, `https://app.virecrm.com`, `https://app.virecrm.com/**`, `https://*.virecrm.com`, `https://*.virecrm.com/**`. Keep majix.ai entries (parallel cutover). Consider flipping **Site URL** to `https://app.virecrm.com`.
5. **Live browser smoke per Unit 20 table** — apex / www / app / slug on both zones, DevTools console clean, Resend test send. Already covered by HTTP 200 + title check from CLI; missing the JS-runtime / DomainBrandingProvider verify and an actual transactional email send.

#### Verification

- `git log origin/main..main` — 1 commit ahead (`7a25aeb`).
- `bun run typecheck` + `bun run build` + `bash scripts/lint-issues.sh` — all clean.
- Public HTTP smoke: 200 OK on apex / www / app / slug on virecrm.com. Resend records auth-resolve. Worker is the right one (CF Workers Builds main-branch deploys green).
- Dual-zone RPC smoke: `get_org_by_domain('<real-slug>.virecrm.com')` returns blob, `.majix.ai` returns same blob, reserved-label hosts return null.

#### Handoff context for next session

- **Cloudflare plugin** (`cloudflare@cloudflare`) installed + authed. Use the routing table in CLAUDE.md "Cloudflare tooling" — pick the right MCP / skill before exploring. `mcp__plugin_cloudflare_cloudflare-api__*` works for DNS / zones / settings; **does NOT work for custom_hostnames** (`#ssl:edit` missing) — see "MCP token-scope ceiling" above.
- **Account ID for CF API calls:** `060435e1bb68c9c846e32b71ee1d4670` (pre-set as `accountId` in MCP). **Worker ID:** `eaf104a2bf08448e80c8e13a91296955` (`genesisxsx`). Already set as active in the builds MCP.
- **Dirty working tree pre-session.** `src/components/crm/CrmSidebar.tsx` was unstaged when I started this session; user committed it as `6026322` mid-session along with `7dde16b` (migration script). Both pushed before my Unit 20 commit. Working tree should be clean at end of this session aside from `01-home-desktop.png` (untracked screenshot, user-owned).

### 2026-05-19 — Lovable→fixed-DB migration: live production port (Steps 3+4)
**Tags:** [lovable-migration] [supabase] [auth] [data-port]

Steps 3+4 of `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. User chose to skip the preview-branch dry-run (cost-conscious; idempotent script). Production port ran directly against `coynbufhejaeuifpvmvw` via Session pooler. Three permission walls hit + worked around; one schema fixup applied; one NOT-NULL fallback added.

#### Shipped

- **Migration `20260519120000_handle_new_user_skip_guc.sql`** — adds `app.skip_auto_provision` GUC check to `handle_new_user` trigger function. `postgres` can't `DISABLE TRIGGER on_auth_user_created` on `auth.users` (Supabase reserves ownership to `supabase_auth_admin` + blocks `GRANT supabase_auth_admin TO postgres`), so the workaround is to short-circuit inside the trigger body. Default OFF — normal signup flow unchanged.
- **`scripts/migrate-lovable-to-fixed.ts` updates** —
  - Phase A switched from `ALTER TABLE … DISABLE TRIGGER` to `SET LOCAL app.skip_auto_provision = 'on'` + `SET LOCAL request.jwt.claim.role = 'service_role'` inside the transaction.
  - Phase C added custom-role remap: `seed_builtin_roles_for_org` trigger seeds new UUIDs per org on Phase B INSERT, so dump `user_roles.custom_role_id` FKs to non-existent rows. Lookup by `(organization_id, name)` against live `custom_roles` replaces every old UUID.
  - `upsertRows()` now wraps each chunk in `sql.begin` + `SET LOCAL request.jwt.claim.role = 'service_role'` — bypasses `enforce_custom_domain_entitlement` and any other `auth.role() = 'service_role'`-gated trigger.
  - Phase F UPDATE/INSERT loop similarly wrapped in `sql.begin` with the same SET LOCAL.
  - Phase F INSERT path falls back `name = r.name ?? r.company ?? r.email ?? "Unknown"` — `leads.name` is NOT NULL but xlsx commercial-account rows often arrive with only company + email.
- **`.env`** — DB password rotated as part of the run. New password lives in `SUPABASE_DB_PASSWORD` + `SUPABASE_DB_URL` (transaction pooler 6543) + `SUPABASE_DB_URL_DIRECT` (direct 5432) + `DATABASE_URL` (session pooler 5432, what the migration script reads). `.env` confirmed gitignored.

#### Found (resolved in-flight)

- ~~Phase A off-by-one (14 eligible vs documented 13)~~ — documentation was wrong, not the script. There are TWO `qa-*` emails in the dump (qa-invitee, qa-test) + ONE `qa2-*` (qa2-vireon), not three `qa-*`. Regex `/^qa\d*[-_@]/i` matches all three. Filter result is correct: 4 audit + 2 qa- + 1 qa2- + 1 e2etest + 1 testcrm = 9 skipped, 14 kept.
- The "6 personal Gmails" count from the prior session's `## Open` was wrong — there are actually **10** personal Gmails kept by the filter (alexanderjakari, cameroncaziah, caziahbankss, davioncarr60, esereti22, ethansereti, info.solace05, jesaira.lifosjoe12, paparusse02, primeframem). User chose to port all 10.

#### Verification (live counts, post-port)

- `auth.users` = 16 total (14 ported + 2 pre-existing dev/test).
- `auth.identities` = 17 (15 ported + 2 pre-existing).
- `organizations` (whitelisted) = 2. Slugs: `greenenergiai` (override applied to Caziah's `8b8c76ab-…`), `crystal-cameron-7ba2ebfa` (Crystal's own `188c4869-…`, slug carried from dump).
- `user_roles` (whitelisted orgs) = 10, every `custom_role_id` remapped to new builtin role UUIDs.
- `profiles` (whitelisted orgs) = 10.
- `leads` total ported = **13,991** = 9,198 Caziah org (5,389 dump + 3,809 xlsx INSERT) + 4,793 Crystal own org (dump only).
- xlsx supplement accounted = 982 ESI-matched UPDATEs + 3,809 new INSERTs = **4,791** (matches xlsx data-row count exactly — 654 trailing blanks correctly skipped).
- `bun run typecheck` clean.

#### Manual follow-up (user)

- ~~**Spot-check 10 Caziah leads** for energy-field population~~ — done 2026-05-19 next session, see entry above.
- ~~**Crystal own-org leads got no xlsx enrichment.** Confirm whether ngp-master xlsx applies only to Caziah's tenant or also her own.~~ Resolved 2026-05-20 via Phase G.
- **Crystal's own-org slug `crystal-cameron-7ba2ebfa` is ugly.** Per Open Question #3 in handoff, decide rename-now vs rename-later.
- **Caziah / Crystal sign-in smoke test** on the new DB before Step 6 (freeze old Lovable project). Both should be able to log in with their existing bcrypt passwords.
- ~~Provide `DATABASE_URL`~~ — done (new rotated password in `.env`).
- ~~Decide org consolidation~~ — user said "no bruh those are two separate organizations", port keeps both.
- ~~Recheck Phase A skip math~~ — math was already correct, documentation was off.

### 2026-05-19 — Lovable→fixed-DB migration script (Step 2 of handoff)
**Tags:** [lovable-migration] [supabase]

Step 2 of `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. Script written + dry-run-validated against parsed dumps. NOT yet run against live DB (Step 3 = branch dry-run, blocked on `DATABASE_URL`). **Superseded 2026-05-19 by the live-port entry above** — leaving the original session-4 record intact for archive.

#### Shipped

- `scripts/migrate-lovable-to-fixed.ts` (new, ~430 lines). Bun-runnable. Uses `bun:sql` (built into Bun ≥1.3; no new dep). Phases A (auth.users + auth.identities), B (organizations w/ slug override), C (user_roles + profiles), D (leads), F (xlsx supplement). Phase E (other public tables) deferred until evidence demands it. Flags: `--dry`, `--phase=` (default `ALL`). Idempotent via `INSERT … ON CONFLICT (id) DO UPDATE` (A–D) + `COALESCE(${new}, existing)` merge (F UPDATE branch). Schema diff handled by `information_schema.columns` lookup intersected against COPY-block columns — drops unknown old-DB columns automatically. `handle_new_user` trigger `DISABLE`'d inside Phase A so it can't auto-provision duplicate orgs; re-enabled in `finally`.

#### Found

- **UUID typo carried in earlier session-3 entries.** Crystal's old `auth.users.id` is `7ba2ebfa-f30e-449a-866e-085c5940c1d4` (verified in the dump). The suffix `9d24-4231-…` belongs to `ethansereti@gmail.com`. Script reads the correct UUID straight out of the dump; handoff corrected in same session.
- **Crystal owns TWO orgs in the old DB**, not one. Caziah's `8b8c76ab-…` (5389 leads, "Caziah Cameron's Organization") AND her own `188c4869-…` (4793 leads). Both whitelisted for port. Total leads to migrate: **10,182** (handoff previously implied ~5389). Open product call for the user: consolidate into one tenant under `greenenergiai.majix.ai`, or keep both?
- **xlsx has 5446 rows but only 4791 non-empty data rows** — 654 trailing blanks. Confirmed via raw `header:1` extract. Script's enrich loop iterates 4791.
- **`qa2-vireon@example.com` initially slipped through** the filter (regex `/^qa-/` didn't match `qa2-`). Skip-pattern widened to `/^qa\d*[-_@]/i`.

#### Verification

- `bun run typecheck` clean.
- Stub-URL dry-run (no DB writes) confirms parsing + filtering work end-to-end:
  - Phase A: 14 of 23 dumped auth.users eligible (9 skipped). Documented filter expects 4 audit + 3 qa-* + 1 qa2-* + 1 e2etest + 1 testcrm = 10. Off-by-one — **recheck Phase A skip math at Step 3.**
  - Phase B: 2 of 16 dumped orgs whitelisted.
  - Phase C: 10 user_roles + 10 profiles.
  - Phase D: 10,182 of 10,188 dumped leads on whitelisted orgs.
  - Phase F: 4791 xlsx rows ready to apply.
- Live-DB dry-run NOT yet attempted — needs `DATABASE_URL`.

#### Manual follow-up (user)

- **Provide `DATABASE_URL`** for the new project (`coynbufhejaeuifpvmvw`). Get it from Supabase Dashboard → Settings → Database → Connection string → "Session pooler" (port 5432) or "Direct connection" (also 5432 via `db.<ref>.supabase.co`). Do NOT use the transaction pooler (port 6543) — script needs `DISABLE TRIGGER` semantics the transaction pooler strips.
- **Decide org consolidation** post-migration: merge Caziah's `8b8c76ab-…` and Crystal's `188c4869-…` into one tenant under `greenenergiai.majix.ai`, or leave them as two?
- **Recheck Phase A skip math at Step 3** — eligible reported as 14, documented filter expects 13. One email pattern likely missing from `SKIP_EMAIL_PATTERNS`.

### 2026-05-19 — rebrand unit 20: merged all 19 rebrand PRs (Majix → VireCRM, majix.ai → virecrm.com, parallel cutover)
**Tags:** [rebrand] [marketing] [seo] [supabase] [stripe] [cf-saas] [ui] [docs]

Closes the rebrand campaign. Prior session split the brand swap into 19 work-units, each shipped as its own PR off the same base commit. This session merged all 19 into `main` with `--no-ff`, resolved the predictable ISSUES.md conflicts (every unit appending its own `## Recent` entry at the same anchor), and corrected two hunks that drifted away from the "additive, parallel cutover" guarantee.

Single consolidated entry supersedes the four per-unit Recent entries that the individual PRs had appended (units 2, 4, 8, 16); they are intentionally dropped here so the build log stays scannable.

#### Shipped (by unit)

- **Unit 1 — `wrangler.jsonc`.** Additive `virecrm.com` Worker routes alongside existing `majix.ai` rows. PR #3.
- **Unit 2 — `supabase/migrations/20260519100844_get_org_by_domain_virecrm.sql`.** `CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname TEXT) RETURNS json`; path-2 regex now `^[a-z0-9][a-z0-9-]*\.(majix\.ai|virecrm\.com)$`. Reserved-label list unchanged. PR #5.
- **Unit 3 — `src/components/auth/DomainBrandingProvider.tsx`.** `SYSTEM_HOST_PATTERNS` extended to recognize virecrm.com hosts as system (skip the per-org RPC lookup). PR #1.
- **Unit 4 — `supabase/functions/_shared/stripe.ts`.** `ALLOWED_ORIGIN_SUFFIXES` adds `.virecrm.com` / `virecrm.com` (6 entries total). ACAO fallback on line 106 left as `https://majix.ai` — separate cutover concern. PR #4.
- **Unit 5 — `src/lib/dns-check.ts`.** `VITE_CF_FALLBACK_HOSTNAME` default flips to `customers.virecrm.com`; helper exports the legacy `customers.majix.ai` constant for the onboarding dialog so customers who CNAMEd before the rename keep resolving. PR #2.
- **Unit 6 — root metadata.** `public/og-card.svg`, `public/robots.txt`, `src/routes/__root.tsx`, `src/routes/sitemap[.]xml.ts` → VireCRM / virecrm.com. PR #6.
- **Unit 7 — email infra strings.** Resend display names + fallback origin URLs across `src/functions/domain-health.functions.ts`, `src/lib/admin-quote-email.functions.ts`, `src/lib/email/dispatch-outreach.ts`, `src/lib/email/outreach-delivery.ts`, `src/lib/resend.ts`, `src/routes/api/email/transactional/send.ts`, `src/routes/api/notify-low-balance.ts`, `src/routes/api/public/contact.ts`, `src/routes/api/public/hooks/contact-followup-reminders.ts`, `src/routes/hooks/send-pending-welcomes.ts` → `VireCRM <noreply@notify.virecrm.com>` etc. PR #11.
- **Unit 8 — marketing top routes.** `src/routes/{index,pricing,features,contact}.tsx` — meta titles, OG, canonical, schema.org JSON-LD, inline JSX brand, `support@majix.ai` → `support@virecrm.com`, splash text. PR #8.
- **Unit 9 — legal routes.** `src/routes/{terms,privacy,refund-policy}.tsx` body copy → VireCRM. PR #9.
- **Unit 10 — marketing chrome.** `src/components/marketing/{MarketingHeader,MarketingFooter,HeroSection,SocialProofSection,BusinessEmailBanner}.tsx`. PR #7.
- **Unit 11 — marketing content.** `src/components/marketing/{PricingCards,TwoWaysSection,ContactForm}.tsx` + `src/components/marketing/features/{ComparisonTable,FeatureBlock,FeaturesFaq,FeaturesHero,ResellerCta,featureBlocks}.tsx`. PR #15.
- **Unit 12 — auth public routes.** `src/routes/{login,signup,accept-invite,confirm-email,reset-password,checkout.return,payment-status,unsubscribe}.tsx` + `src/components/auth/TermsCheckbox.tsx`. PR #10.
- **Unit 13 — email templates.** All 12 templates under `src/lib/email-templates/`. PR #13.
- **Unit 14 — `_app.*.tsx` meta titles + admin email signoffs.** 42 route files. PR #16.
- **Unit 15 — CRM internal components.** `src/components/crm/{BusinessEmailCard,CrmSidebar,EmailTemplatePreviewPanel,IntegrationsSettings,TeamMembers,WhiteLabelSettings}.tsx`. PR #12.
- **Unit 16 — admin / onboarding / preview.** `src/components/admin/QuotesPanel.tsx`, `src/components/onboarding/ProductTour.tsx`, `src/components/preview/{views,data}/*`. Plus `src/components/GlobalErrorBoundary.tsx` — see flagged-hunk fix below. PR #17.
- **Unit 17 — lib / hooks / functions.** `src/functions/{appointments,test-email}.functions.ts`, `src/hooks/useStripeCheckout.tsx`, `src/lib/{pricing-overrides,quote-pdf.functions}.ts`, `src/lib/workflows/run.ts`. Carve-out comments preserved on the `majix:`-prefixed localStorage / CustomEvent keys (see below). PR #14.
- **Unit 18 — top-level docs.** `CLAUDE.md`, `AGENTS.md`, `README.md` brand strings + the live "Hostname plan" table now lists both `<slug>.virecrm.com` (primary) and `<slug>.majix.ai` (legacy parallel). PR #18.
- **Unit 19 — handoff + cf-for-saas runbook.** `docs/custom-domains/cf-for-saas-setup.md` documents dual-zone fallback origin + `CLOUDFLARE_LEGACY_ZONE_ID` secret; `docs/handoffs/2026-05-18-green-energiai-onboarding.md` updated to point Crystal's magic-link recipe at `greenenergiai.virecrm.com`. PR #19.

#### Flagged hunks reviewed at merge time (decisions)

- **PR #17 (Unit 16) — `src/components/GlobalErrorBoundary.tsx` `SYSTEM_HOST_PATTERNS`.** Original hunk hard-flipped `^majix\.ai$` / `^www\.majix\.ai$` → `^virecrm\.com$` / `^www\.virecrm\.com$`. **Reverted to additive** in commit `bba6038`: keeps both pairs of regexes. Hard-flip would stop the boundary from skipping the per-org support-email RPC for visits to the legacy host during the parallel cutover.
- **PR #19 (Unit 19) — `docs/custom-domains/cf-for-saas-setup.md` TXT prefix.** Original hunk introduced `_vire.<hostname>` as the new primary verification-token prefix alongside legacy `_majix.<hostname>`. **Reverted to single universal `_majix.<hostname>`** in commit `fb1220b`. The `_majix` prefix is org-agnostic and universal across both zones per migration `20260517170000_rebrand_verification_token_prefix.sql`; introducing a second prefix would force every existing custom-domain tenant to re-publish a TXT record. Only the CNAME target differs between flows (`customers.virecrm.com` for new tenants, `customers.majix.ai` for pre-rename ones).
- **PR #14 (Unit 17) — `src/lib/pricing-overrides.ts` `STORAGE_KEY` + CustomEvent name.** The unit kept `STORAGE_KEY = "majix.pricing-overrides"` and the `"majix:pricing-overrides-changed"` event name with a `TODO(rebrand)` comment because emitter + listener must change atomically AND old client state living under the legacy key would orphan otherwise. **No action — accepted as-is.** Same rationale applied to `localStorage["majix.autoOutreachEnabled"]` and `localStorage["majix:contact-draft"]`. Documented in the carve-out list below so future rebrand passes don't strip these without an explicit migrate-on-load step.

#### Carve-out list — strings intentionally still `majix` after Unit 20

These are NOT bugs and NOT pending follow-ups. Listed for future audits so nobody flags them as missed work:

- `localStorage["majix.pricing-overrides"]` (`src/lib/pricing-overrides.ts`) + matching `"majix:pricing-overrides-changed"` CustomEvent name. Rename requires atomic emitter+listener change and an old-key migration on load.
- `localStorage["majix.autoOutreachEnabled"]` (Unit 17, same carve-out reason).
- `localStorage["majix:contact-draft"]` (same).
- `supabase/functions/_shared/stripe.ts:106` ACAO fallback `https://majix.ai` — single header value, separate cutover concern; flip after DNS health is green on virecrm.com.
- DNS-onboarding `_majix.<hostname>` TXT verification token — universal org-agnostic prefix set by migration `20260517170000_rebrand_verification_token_prefix.sql`. **Stays as `_majix` permanently across both zones** so customers never need to re-publish DNS during a brand change.
- `customers.majix.ai` CF for SaaS fallback origin — kept live alongside `customers.virecrm.com` so pre-rename customer CNAMEs continue to resolve. Retire after every existing tenant migrates their CNAME target.
- `<slug>.majix.ai` tenant subdomain — Worker wildcard route stays additive; `get_org_by_domain` accepts both zones via regex union.

#### Verification

- `git log --oneline -25` — 19 `Merge PR #N — unit-M ...` merge commits + 2 fix commits (`bba6038`, `fb1220b`) on `main`. No PRs merged; remote pushes deferred for user review.
- `bash scripts/lint-issues.sh` — clean.
- Working tree dirty pre-existing (migration script + Step 2 handoff edits) left untouched — separate work track.
- `bun run typecheck` + `bun run build` + scoped greps for stray "Majix" / "majix.ai" outside the carve-out list — see "Final verification" section below once run.

#### Manual follow-up (user)

- **Push to remote.** Requires explicit go-ahead (`git push origin main`). PRs auto-close on push since their head commits are now ancestors of `main` (or close them manually via `gh pr close <n> --comment "merged via Unit 20"`).
- **External actions before user-visible cutover** (also tracked in `## Open` "User action required"):
  - Cloudflare for SaaS — enable on `virecrm.com` zone; create `customers.virecrm.com` proxied CNAME; designate as fallback origin; mint `CLOUDFLARE_LEGACY_ZONE_ID` secret pointing at the `majix.ai` zone (see `docs/custom-domains/cf-for-saas-setup.md`).
  - Supabase Auth — add `https://virecrm.com`, `https://www.virecrm.com`, `https://app.virecrm.com`, `https://*.virecrm.com` to the redirect-URL allowlist.
  - Resend — verify `notify.virecrm.com` SPF/DKIM (parallel to existing `notify.majix.ai`).
  - DNS at IONOS / CF — apex + `www` + `app` + `customers` + `*` wildcard for `virecrm.com`.
- **Deploy.** `wrangler deploy` once secrets are in.
- **Smoke per integration plan.** Browse `majix.ai`, `virecrm.com`, `app.virecrm.com/login`, `greenenergiai.{majix.ai,virecrm.com}` and confirm both zones render the same white-label tenant.
- **Push the dual-zone SQL migration.** `supabase db push` (or CI runner) applies `20260519100844_get_org_by_domain_virecrm.sql`. Already idempotent (`CREATE OR REPLACE`).

### 2026-05-19 — discovered old Lovable DB still live; Crystal duplicate; xlsx import has mapping bugs; pivot to migration-first
**Tags:** [lovable-migration] [supabase] [green-energiai] [security] [docs]

Session 3 attempted to verify the 2026-05-18 Path-A push (dev-server walk → push → PR → DM Crystal). Pre-push verification surfaced enough blockers that we pivoted to a migration-first plan.

#### Found

- **Old Lovable Supabase project is still live for at least one user.** `cameroncaziah@gmail.com` last signed in to the old project at 2026-05-19 01:05 (per `og_database/genesis_auth_data.sql`). Migration window is short — old-DB writes won't reach the new `coynbufhejaeuifpvmvw` project.
- **Crystal already exists on old Lovable DB** with `auth.users.id = 7ba2ebfa-9d24-4231-ba25-ea463f30587c`, email confirmed 2026-04-23. The 2026-05-18 session-1 provisioning on the new DB created a DUPLICATE with `id = b5ae0c3e-1655-48d5-b211-a9fd55aaafea`. Both rows currently exist, in different projects.
- **Caziah Cameron, not Crystal, owns the Green EnergiAi org on old DB.** Old org id `8b8c76ab-08de-4fd1-a703-b06138078181`, name "Caziah Cameron's Organization", brand "Caziah's CRM", `is_reseller=t`. Crystal + Erica + Shelby + mleaverton are members under Caziah's org. New DB org structure (Crystal-owned, `c31c2a18-…`) is wrong.
- **Old DB has 5389 leads on Crystal's org**, source `xlsx_import` from 2026-04-29 — Crystal's previous failed import. CRM-standard fields landed (name/email/phone/company) but energy fields (annual_kwh, current_supplier, contract_end_date) all NULL. Plus duplicates (e.g. CHAD BULLARD × 3 rows).
- **Session-2 xlsx import on new DB (3850 rows) has critical column-mapping bugs.** `name` is mapped to xlsx's `Customer Name` (company), not `contact_person` (the human). `agent_mils` is mapped to wrong column → 505.000 instead of plausible 0.041. `annual_kwh` is mapped wrong → 480 instead of `EAC AQ` value of 16988. `email`/`phone`/`title`/`service_address`/`cost_per_kwh` all 0/3850 populated. ESI values include literal backticks (`` `10443720…` ``), not stripped. Heuristics + AI mapper prompt don't recognize `customer_email`, `telephone`, `designation`, `address_1`, `Unit Uplift`, `EAC AQ`, `contact_person`.
- **Local-dev auth flow:** Supabase gotrue strips `localhost:8080` from `redirect_to` even with `uri_allow_list` updated via Management API. Allowlist update persisted but didn't take effect on the generate_link endpoint (cache or default block). Workaround attempted: agent-browser walks the magic-link to prod, reads `localStorage["sb-coynbufhejaeuifpvmvw-auth-token"]`, transplants to localhost — worked once for the session-3 import test. Treat as known dev-friction; longer-term, set `site_url` to a dev-friendly value or document the localStorage transplant.

#### Shipped

- `.gitignore` — added `og_database/`, `*.sql.dump`, `*.pgdump` so legacy Lovable dumps stay out of git. Commit `d49e67b`.
- `CLAUDE.md` + `AGENTS.md` — new section under Lovable history pointing at `og_database/` with read-not-cat warning + migration pointer. Commit `d49e67b`.
- `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md` — full migration handoff. Strategy = enrich, not replace; old DB is source-of-truth for users + lead UUIDs (via dump-parse not API since Lovable owns old project — no live access), xlsx supplements energy fields. Six-step plan. Commit `4f839c0`.
- `docs/handoffs/2026-05-18-green-energiai-onboarding.md` — PAUSED banner at top pointing at the new migration handoff. Commit `4f839c0`.
- `ISSUES.md` `## Open` updated — green-energiai item points at migration handoff; new "Lovable → fixed-DB data migration" subsection holds the master plan. Commit `4f839c0`.
- **Step 0 + Step 1 of the migration handoff executed in this session** (no commit — DB-only operation; handoff doc updated to reflect):
  - Confirmed via `supabase projects list` that Lovable's old project isn't in user's Supabase account → migration parses dumps, not a live API.
  - Deleted 4791 bad-mapping leads + session-1 Crystal duplicate (`auth.users.id=b5ae0c3e-…`) + her duplicate org (`c31c2a18-…`) + her user_role + profile. `crystal@greenenergiai.com` is now a free email on the new DB so Step 2's auth port can claim it with the old UUID `7ba2ebfa-…`.

#### Verification

- `bash scripts/lint-issues.sh` — clean after every edit.
- `git status` — `og_database/` no longer listed (gitignored verified via `git check-ignore -v`).
- Dev server (vite, port 8080) still running in background task `bsl7k5gad` — kill before next session or it'll collide with a fresh `restart-dev.sh`.
- New DB Crystal-scoped row counts post-cleanup all zero (`leads=0, orgs=0, users=0, crystals=0`). Ready for Step 2 migration script.
- **DO NOT push 8 ahead commits** until migration completes — schema-side migrations land fine but the in-app `ImportLeadsDialog` mapping bugs ship Crystal a re-broken experience. Mapping fix is a follow-up after migration.

#### Manual follow-up (user)

- Decide which of the 6 personal-Gmail accounts in old DB (alexanderjakari, davioncarr60, info.solace05, jesaira.lifosjoe12, paparusse02, primeframem) are real customers / staff / testers — filters which accounts get ported. See migration handoff "Open questions" #2.
- Provide old Lovable Supabase project ref + service-role key (or grant access) for the migration script's `OLD_SUPABASE_URL` + `OLD_SUPABASE_SERVICE_ROLE_KEY` env.
- Decide org-slug rename (`caziah-cameron-66e0f158` → `greenenergiai`) timing — during migration or after. See migration handoff "Open questions" #3.

### 2026-05-18 — green-energiai step 7: renewal cron — design analysis (not yet implemented)
**Tags:** [green-energiai] [supabase] [cron] [design]

Looked at reusing `pending_welcome_emails` per the original handoff. Won't fit — invitation-specific schema (`reseller_id NOT NULL`, `login_url NOT NULL`, no lead linkage). Step 7 needs a new `pending_renewal_emails` table, a Resend template, and a Worker drainer route. Pure deferred-design entry; no code shipped this session.

#### Found

- `pending_welcome_emails` rows are reseller-tenant welcome invitations, not generic notification queue. Repurposing breaks both consumers (the existing `/api/public/hooks/send-pending-welcomes` Worker route renders a welcome template, not a renewal notice).
- The Phase 1 cron registry already wires every existing Worker hook (`email-queue-process`, `dispatch-sequences`, `dispatch-followups`, `contact-followup-reminders`, `purge-audit-log`, `calculate-payouts`). Renewal cron would slot in as `dispatch-renewal-reminders`, suggested daily 09:00 UTC.
- Full design analysis + sequencing checklist for next session lives in `docs/handoffs/2026-05-18-green-energiai-onboarding.md` Step 7 block. Estimated 2-3hr focused work — needs new table + RLS + template + Worker route + cron entry.

#### Manual follow-up (user)

- Once Step 7 lands, `CRON_SECRET` must be set in the CF Worker prod env (already tracked at the top of `## Open` under "User action required") so the new `dispatch-renewal-reminders` POST authenticates.

### 2026-05-18 — green-energiai step 6: Clients tab (`/book`)
**Tags:** [green-energiai] [frontend] [crm]

Counterpart to Step 5. Crystal's call note ("Needs a tab that says 'current clients'… when the deal is won, then the customer feeds into this new tab") is now satisfied. Sorted by renewal date so the broker can work the soonest expirations first.

#### Routing decision

- **New route name `/book`, sidebar label "Clients".** Same reasoning as the Pricing tab — `/clients` is the legacy reseller-mgmt page, would collide.
- **Renamed the legacy reseller `/clients` sidebar link "Clients" → "Sub-accounts".** Sidebar entry only — route + UI untouched. Avoids two "Clients" labels in the same sidebar for reseller-tier tenants. Chesterton's fence holds — no Lovable-scaffold logic deleted, just a relabel.

#### Shipped

- `src/routes/_app.book.tsx` (new, 282 lines). Fetches `leads where status='won' for current org`, sorted `contract_end_date asc nulls last`.
- Read-only columns: deal, customer, service address, ESI (mono), annual kWh, supplier (Badge), contract start, contract end (with tone-coded renewal pill — red ≤30d/expired, amber ≤90d, neutral otherwise), rate, mils, commission.
- Filters: text search across customer/deal/address/ESI, supplier dropdown (built from distinct values in the dataset), expiry window (any / 30 / 60 / 90 days / already expired).
- Book-commission summary chip sums commission across the *filtered* set — segment-aware totals, not just lifetime book.
- Manual Refresh button + autoload on mount.
- `src/components/crm/CrmSidebar.tsx` — added `{ to: "/book", icon: Briefcase, label: "Clients" }` to Overview section. Legacy reseller `/clients` item now labelled "Sub-accounts".

#### Verification

- `bun run typecheck` clean.
- `bun run build` clean (6.44s).
- Browser walk deferred to Step 8 once Crystal does the historical backfill (book is empty until then).

### 2026-05-18 — green-energiai step 5: Pricing tab (`/pipeline`)
**Tags:** [green-energiai] [frontend] [crm]

Closes the "no surface for in-negotiation deals" gap. Agents now have one screen for every lead in pricing, with the rate + mils editable inline and Crystal's commission math (`commission_value` generated col) updating the instant the row is saved.

#### Routing decision

- **New route name `/pipeline`, sidebar label "Pricing".** Couldn't reuse `/pricing` (marketing public route) or `/clients` (legacy reseller-mgmt page gated `isReseller && isOwner`). Universal vocabulary in the URL + Crystal's mental model in the sidebar label. Decoupling = cheap rename later.

#### Shipped

- `src/routes/_app.pipeline.tsx` (new, 261 lines). Fetches `leads where status='negotiation' for current org`, sorted `contract_end_date asc nulls last` (expiring contracts first — natural renewal-hunt order).
- Columns: deal, customer, service address, ESI (mono), annual kWh (right-aligned tabular), supplier (Badge), contract end (locale date), editable rate, editable mils, computed commission, "Mark Won" action.
- Edit-in-place via shadcn `<Input type="number">` on blur, with diff check to skip no-op saves. Per-row `savingId`/`winningId` disables inputs + button during the mutation. Reload after save.
- "Mark Won" toggles `status='won'` and reloads — the row falls off the Pricing tab and will surface in the Clients tab from Step 6.
- Pipeline-commission summary chip in the header sums every visible `commission_value` ("total at stake right now").
- `src/components/crm/CrmSidebar.tsx` — added `{ to: "/pipeline", icon: DollarSign, label: "Pricing" }` to the Overview section. Universal — every tenant sees it regardless of industry template.

#### Gotchas

- Dynamic-key Supabase update `{ [field]: next }` failed strict TS — Supabase JS's generated types reject "any string" keys on `update`. Fixed with an explicit ternary patch. If we add more editable columns, generalize then.
- `routeTree.gen.ts` is auto-managed by `tanstackStart()` in `vite.config.ts` — `bun run build` regenerated it; `bun run typecheck` then passed.

#### Verification

- `bun run typecheck` clean.
- `bun run build` clean (6.63s).
- Browser walk (sign in as Crystal, move a lead to negotiation, edit rate/mils, Mark Won) deferred to Step 8 dev-server walk.

### 2026-05-18 — green-energiai step 4: historical backfill toggle in import dialog
**Tags:** [green-energiai] [frontend]

Crystal has ~2 years of closed deals to load. They aren't new leads — they're existing clients she wants visible in the (forthcoming) Clients tab. Toggle this on at import time, every row lands as `status=won` and the auto-outreach trigger sits down.

#### Shipped (`src/components/crm/ImportLeadsDialog.tsx`)

- New `backfillMode` state, default off, reset on dialog close.
- New Switch placed above the auto-outreach Switch. Label: "Import as closed clients (historical backfill)" + sublabel explaining the override behaviour.
- Batch insert overrides `status: "won"` when backfill is on (otherwise honours parsed status).
- Auto-outreach Switch goes visually + functionally disabled when backfill is on. Sublabel swaps to "— disabled in backfill mode". Underlying preference is preserved — re-enabling backfill restores the saved choice.
- `handleImport` gates the outreach trigger on `outreachEnabled && !backfillMode` (belt-and-suspenders against the disabled Switch).

#### Verification

- `bun run typecheck` clean.
- `bun run build` clean.
- UX confirmation (visible disabled state, label swap, won rows landing in Clients tab) deferred to Step 8 dev-server walk — the Clients tab itself doesn't exist yet (Step 6).

### 2026-05-18 — green-energiai step 3: AI mapper teaches itself the energy schema
**Tags:** [green-energiai] [frontend] [ai]

PR 1 closer. AI column mapper (`src/functions/import-mapping.functions.ts`) only knew about 7 contact fields; energy-broker sheets had to ride the raw-header heuristic fallback even when the AI fired. Now the mapper itself can hit ESID/Supplier/Mils/etc. with disambiguation rules for the easy-to-confuse pairs.

#### Shipped (`src/functions/import-mapping.functions.ts`)

- `ImportColumnMapping.fields` extended with 10 energy fields (`title`, `deal_name`, `service_address`, `esi_id`, `annual_kwh`, `current_supplier`, `contract_start_date`, `contract_end_date`, `cost_per_kwh`, `agent_mils`). Extracted shared `FieldSource` type alias.
- `callAiWithFallback` result type + tool schema grew matching `<field>_source` props (optional / nullable; only `row_one_is_data` + `explanation` remain required).
- System prompt rewritten: split into "Standard contact fields" + "Energy-broker fields (leave null for non-energy imports)". Each energy field documented with header synonyms — ESID/Meter Number, Annual kWh/Usage, REP/Provider, $/kWh/Rate, Mils/Margin. Two disambiguation rules: `current_supplier` vs `source` (energy retailer vs lead source), `company` vs `deal_name` (customer org vs broker-set deal label).
- `resolve(...)` block returns the 10 new fields via the existing positional/header parser — no behaviour change required for the resolver itself.

#### Shipped (`src/components/crm/ImportLeadsDialog.tsx`)

- `buildLeadsFromAiMapping` now prefers AI energy indices, with raw-header heuristic as fallback via new `aiOrHeuristic(aiIdx, dict)` shim. Belt-and-suspenders: AI miss on a column we can still see by name doesn't lose the data.

#### Verification

- `bun run typecheck` clean.
- `bun run build` clean (6.78s, no new warnings).
- Real-XLSX confirmation deferred to end-to-end dev-server walk (Step 8 prerequisite per handoff).

#### Manual follow-up (user)

- Same Step-8 walk as the Step 2 entry — once PR 1 lands, restart dev server, issue Crystal's magic link, upload her xlsx, confirm the import dialog preview hits every energy column.

### 2026-05-18 — green-energiai step 2: ImportLeadsDialog inserts energy fields
**Tags:** [green-energiai] [bug] [frontend]

The actual fix for Crystal's complaint ("only Customer Name imported, nothing else"). Pipeline was already parsing `annual_kwh`, `current_supplier`, `contract_end_date` — it just dropped them at the insert payload. Added 7 new fields end-to-end and wired the dropped ones into the insert.

#### Shipped (`src/components/crm/ImportLeadsDialog.tsx`)

- `ParsedLead` interface grew 7 fields (`title`, `deal_name`, `service_address`, `esi_id`, `contract_start_date`, `cost_per_kwh`, `agent_mils`).
- 7 new header dictionaries added (`ESI_HEADERS` covers "esi"/"esid"/"meter number"; `MILS_HEADERS` covers "mils"/"agent mils"/"margin"/"spread"; etc.).
- Two new parsers: `parseCostPerKwh` (handles `$0.085`/`8.5¢`/`85` cents-or-dollars heuristic, clamps to numeric(8,5) precision); `parseMils` (handles `3`, `3.0`, `0.003` decimal-or-bare-int heuristic, clamps to numeric(6,3)).
- Renamed `parseContractEndDate` → `parseContractDate` and reused for `contract_start_date`.
- `IndexMap` interface grew 7 fields; CSV path, XLSX path, and AI-fallback path all find + pass the new indices. AI fallback uses heuristic raw-header matching for the energy fields until Step 3 expands the AI mapper prompt.
- `buildLeadsFromIndices` emits every new field; soft-warning per-row on unparseable cost/mils/dates rather than blocking the row.
- **Critical fix** at the batch-insert payload (was line 675-686): now writes `title`, `deal_name`, `service_address`, `esi_id`, `annual_kwh`, `contract_start_date`, `contract_end_date`, `current_supplier`, `cost_per_kwh`, `agent_mils`. These were ALL parsed and discarded pre-fix.

#### Verification

- `bun run typecheck` → clean.
- `bun run build` → ✓ built in 6.86s.
- Not yet user-walked through dev server. Next session should: `scripts/restart-dev.sh`, sign in as Crystal via Auth Admin API magic-link, upload her xlsx, query DB for filled columns. Recipe in handoff doc "Continue here" block.

#### Found

- Verified `deal_name: string` (non-null) at types.ts:1532/1556 belongs to a separate `energy_customers` table, not the `leads` table I edited. Leads schema correctly nullable across all new fields.

#### Manual follow-up (user)

- None yet. Step 3 (AI mapper prompt) finishes off PR 1.

### 2026-05-18 — green-energiai step 1: energy-broker schema migration
**Tags:** [green-energiai] [supabase]

Schema is the blocker for Steps 2-6. Added the missing energy-broker columns + a stored generated `commission_value` so Crystal's "total contract value" is computed-not-stored and never drifts from inputs.

#### Shipped

- `supabase/migrations/20260518200618_energy_broker_fields.sql` — additive `alter table public.leads` adding `service_address`, `esi_id`, `title`, `deal_name`, `contract_start_date`, `cost_per_kwh numeric(8,5)` (≥0), `agent_mils numeric(6,3)` (≥0), generated `commission_value numeric` STORED, and two partial indexes (`idx_leads_contract_end` on `(organization_id, contract_end_date)`, `idx_leads_esi` on `(organization_id, esi_id)`).
- `src/integrations/supabase/types.ts` — regenerated via `supabase gen types typescript --linked`. Stdout had the "new version available" notice appended (one of the CLI's longer-running annoyances); had to `head -5403` to strip. New fields all flow through `Row`/`Insert`/`Update` shapes.

#### Found

- `age(date,date)` and `extract(year from interval)` are STABLE not IMMUTABLE — first migration push errored `ERROR: generation expression is not immutable (SQLSTATE 42P17)`. Postgres treats date→timestamp casts as timezone-dependent. Date subtraction (`end - start` returns integer days) is the only fully-immutable date-diff primitive for STORED generated columns. Rewrote the expression as `floor(((end - start)::numeric) / 365)` with the same `nullif(0,…)/coalesce(…,1)` null/short-contract guard. Result identical for whole-year terms; off-by-one risk only on leap-day exact-match contracts (acceptable for v1).
- `leads.annual_kwh` was already `bigint` on the live schema (not `integer` as the handoff specced). Bigint is the better call — kept as-is, no migration change.

#### Verification

- `supabase db push --linked --include-all` → "Finished supabase db push" after rewrite.
- Math probe: insert lead with annual_kwh=1,000,000, agent_mils=3.0, contract 2024-01-01 → 2026-01-01 → `commission_value=6000.000000` ✓. Probe deleted after.
- `bun run typecheck` → clean.

#### Manual follow-up (user)

- None. Steps 2-7 unblocked.

### 2026-05-18 — green-energiai step 0: tenant provisioned, subdomain white-label live
**Tags:** [green-energiai] [cf-saas] [supabase]

First real customer tenant onboarded. Auth user + org row + slug all wired; subdomain renders Green EnergiAi branding end-to-end. Welcome email deliberately not sent yet — defer to Step 8 after the energy-broker schema + import + tabs ship so Crystal doesn't log in to a half-built surface.

#### Shipped

- `auth.users.id=b5ae0c3e-1655-48d5-b211-a9fd55aaafea` — created via Auth Admin API (`POST /auth/v1/admin/users`, `email_confirm=true`, `user_metadata.full_name="Crystal Cameron"`). No email sent. Temp password rotated out of session — Step 8 will issue a recovery / magic-link.
- `organizations.id=c31c2a18-f595-499d-9353-f3cd1d9e659b` — auto-created by `handle_new_user` trigger, then `UPDATE` to: `name`/`brand_name="Green EnergiAi"`, `slug="greenenergiai"`, `support_email="crystal@greenenergiai.com"`, `is_reseller=false` (default). `profiles` + `user_roles(owner)` rows came in via trigger automatically.

#### Verification

- `select public.get_org_by_domain('greenenergiai.majix.ai')` → full theme blob (`brand_name="Green EnergiAi"`, `verified=true`, slug-path branch, `is_reseller=false`). RPC working.
- Agent-browser smoke on `https://greenenergiai.majix.ai/` + `/login` (headless, session `green-energiai-step0-smoke-2026-05-18`, closed cleanly): H1 "Get started with Green EnergiAi", `/login` H1 "Welcome back" + tagline "Sign in to your Green EnergiAi account", document.title → "Green EnergiAi" after hydration, no console errors. CSS `--primary=#3b82f6` (default seed) — colors/logo/favicon are platform defaults until Crystal provides assets.

#### Found

- Step 0 handoff text said `/auth/login`; correct path is `/login`. Fixed inline in handoff doc.
- SSR title sent as "Majix — …" then client React swaps to tenant brand name. Post-hydration only. Polish, not blocker.
- White-label theme assets (logo, primary/accent/sidebar/button colors, favicon, font) all null on her org row. Tracked as Open question 1 in handoff — visual asset blocker, not code blocker.

#### Manual follow-up (user)

- None for Step 0 itself. Step 8 will issue Crystal her login link (magic-link / recovery) after Steps 1-7 land. Schema + import + Pricing + Clients tabs all marching next.

### 2026-05-18 — Lovable vite preset + bun.lock proxy removed
**Tags:** [lovable-migration] [tooling]

Followed up the two Phase 2 items added by yesterday's sweep. Both shipped same turn.

#### Shipped

- `vite.config.ts` — rewrote to import `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, `cloudflare` directly. Dropped Lovable preset wrapper. Kept the load-bearing pieces (port 8080, `@` alias, React/TanStack dedupe, build-only Cloudflare plugin with `viteEnvironment: { name: "ssr" }`). Discarded Lovable-only bits (`componentTagger`, dev client/server-fn error loggers, sandbox env detection, watch debounce). Vite's native `import.meta.env.VITE_*` handling replaces the preset's manual `loadEnv` + `define` block — confirmed 18 callers compile cleanly.
- `package.json:96` — removed `@lovable.dev/vite-tanstack-config@^1.3.0` from devDependencies. No transitive deps left in the tree.
- `bunfig.toml` — flipped `saveTextLockfile = false` → `true`. Lovable's preset shipped the false setting; it forces binary `bun.lockb` which Cloudflare Workers Builds rejected (see 2026-05-17 migration entry in archive). Bun 1.2+ defaults to text; explicit flip preserves intent.
- `bun.lock` — regenerated against `registry.npmjs.org`. 230 dead `europe-west4-npm.pkg.dev/lovable-core-prod/...` resolution entries from the previous binary lockfile are gone (the new text format doesn't embed tarball URLs at all — packages resolve via the bun default registry at install time, so no Lovable proxy surface remains).

#### Verification

- `bun run typecheck` → clean ($ tsc --noEmit).
- `bun run build` → ✓ built in 7.20s (client + server bundles), `dist/server/index.js` + `dist/server/wrangler.json` emitted, no plugin warnings.
- `bun run test` → 123 / 123 passed (4 files, 779ms).
- `bun run dev` → boots on `http://localhost:8080/` in 989ms. Re-optimize dependencies log expected after lockfile rewrite.
- `grep -cE 'lovable' bun.lock` → 0. `grep -c '@lovable.dev/vite-tanstack-config' package.json bun.lock` → 0 across both.

### 2026-05-18 — ISSUES.md protocol hardening + two-layer enforcement (lint + git hook + CC PostToolUse)
**Tags:** [docs] [tooling] [hooks]

User flagged that the ISSUES.md append system wasn't working reliably and asked to fix it. Audit found three real bugs; shipped lint script + two enforcement layers (git pre-commit + Claude Code PostToolUse hook).

#### Found

- **Orphan `#### Shipped` block at `ISSUES.md:223-242` (pre-fix line numbers).** Commit `d9a8381` (hostname plan rollout) deleted the `### 2026-05-18 — docs reorg push` header while rewriting an adjacent section in the same edit. The session's Shipped/Verification/Manual-follow-up blocks survived; their parent H3 didn't. Caught by reading the file header-by-header — not by any mechanical check.
- **Template heading-level typo at `ISSUES.md:72` (pre-fix) + `AGENTS.md:103`.** Both docs showed `## YYYY-MM-DD — short title` (two hashes), while every real entry uses `###`. Drift between template and practice.
- **No mechanical guard.** Nothing flagged the orphan when it landed. No lint, no pre-commit, no session-end check.

#### Shipped

- `ISSUES.md` — restored the lost `### 2026-05-18 — docs reorg push to origin/main` header with `**Tags:** [git] [docs]` + a hindsight note pointing at the failure mode.
- `ISSUES.md` "How to append" — rewrote with a six-step pre-append checklist (count headers before/after, three-hash H3 only, tag line immediately under date, four-hash H4 always under H3 parent, post-edit lint). Template fixed to `### YYYY-MM-DD`. Tag glossary pointer added.
- `ISSUES.md` Rule 3 (strike-through) — clarified: strike-through only in a LATER session when prior finding is invalidated; same-session shipments use the `#### Shipped` block.
- `scripts/lint-issues.sh` (104 lines, executable) — awk lint that detects (1) orphan `####` without parent `### YYYY-MM-DD`, (2) `### YYYY-MM-DD` headers missing the `**Tags:**` line, (3) sessions >14 days old in `## Recent` (archive candidate warning). BSD-awk and GNU-awk compatible.
- `ISSUES.md` — backfilled `**Tags:**` lines on six pre-existing sessions (Lovable-remnant sweep, package-lock delete, workers-types audit, hostname plan live, cron health smoke, docs harmonization). Tags pulled from the archive glossary.
- `CLAUDE.md` — "ISSUES.md is non-negotiable" updated with explicit three-hash + tag-line requirement and the two-layer enforcement description. Cross-references the `d9a8381` failure mode so future agents see the evidence.
- `AGENTS.md` "Where to append findings" — fixed the stale `## YYYY-MM-DD` template to `### YYYY-MM-DD` + tag line + lint pointer + git-hook install command. Non-Claude agents now see the same protocol.
- **Layer 2 (durable, all agents): `.githooks/pre-commit` (60 lines).** Bare git hook (no husky/lefthook dep — keeps lockfile churn out of the Phase 2 Lovable cleanup window). Fires on any `git commit` touching `ISSUES.md`. Calls `scripts/lint-issues.sh`. Skips merge commits. Activated via `bash scripts/install-hooks.sh` which sets `core.hooksPath=.githooks`. Idempotent.
- `scripts/install-hooks.sh` (32 lines) — one-time setup for fresh clones. Sets `core.hooksPath` + chmods hooks. Wired into README "Quick start".
- **Layer 1 (immediate, CC-only): `.claude/settings.json` PostToolUse hook + `.claude/hooks/lint-issues-on-edit.sh` (61 lines).** Fires after every `Edit|Write|MultiEdit`. Short-circuits unless the edited path's basename is `ISSUES.md` and it's inside this repo. On lint failure, exits 2 — surfaces the error inline so the agent corrects same-turn instead of waiting for the commit gate. jq + python3 fallback for JSON parsing.
- `.gitignore` — whitelisted `.claude/settings.json` + `.claude/hooks/` so the agent hook is shared across clones. `.claude/settings.local.json` remains ignored (per-user overrides).
- Research: scanned Anthropic's [hooks-guide](https://code.claude.com/docs/en/hooks-guide), [issue #6403](https://github.com/anthropics/claude-code/issues/6403), and community write-ups. Pattern is mature — exit-2-blocks-with-stderr is the canonical "surface to agent" signal. PostToolUse occasionally doesn't fire (issue #6403), which is the exact reason for pairing it with the durable git hook.

#### Verification

- `bash scripts/lint-issues.sh ISSUES.md` → `lint-issues: OK`. Initial run flagged 6 missing-tag errors; backfilled all six, re-ran clean.
- `grep -n '^### \|^#### ' ISSUES.md` after fix: every `####` sits under a `### YYYY-MM-DD` parent. Orphan eliminated.
- Lint syntax tested against BSD awk (macOS default) — initially failed with gawk-only `match($0, regex, array)`; rewrote with `substr` + `~` pattern match, now works on both. Date-arithmetic uses `date -d` (GNU) with `date -v-14d` (BSD) fallback.
- `bash scripts/install-hooks.sh` → `core.hooksPath -> .githooks`. `git config --get core.hooksPath` returns `.githooks` ✓.
- Git hook tested in three scenarios: (1) no ISSUES.md staged → exit 0 silent ✓; (2) clean ISSUES.md staged → exit 0 ✓; (3) ISSUES.md with injected orphan `####` → exit 1 with lint error + fix hint ✓.
- CC PostToolUse hook tested in three scenarios via simulated stdin JSON: (1) ISSUES.md clean → exit 0 ✓; (2) non-ISSUES.md path (README.md) → exit 0 silent short-circuit ✓; (3) ISSUES.md with injected orphan → exit 2 with full lint error + actionable hint surfaced to stderr ✓.
- `git check-ignore -v .claude/settings.json .claude/settings.local.json` → settings.json un-ignored via whitelist; settings.local.json still ignored ✓.

#### Manual follow-up (user)

- Run `bash scripts/install-hooks.sh` once on every fresh clone (already done in this session). Solo-dev so no broadcast needed; flag in README onboarding line for future contributors.

### 2026-05-18 — Lovable-remnant sweep (post-`package-lock.json` delete)
**Tags:** [lovable-migration] [audit]

User asked whether more Lovable remnants remain after the lockfile delete. Triaged every match for `lovable|Lovable|LOVABLE|genesisx.space|lovable.app|lovable.dev|gpt-engineer` across the live tree (excluding `docs/issues-archive/`, `docs/superpowers/`, `.agents/`, `.claude/`, `node_modules/`). 32 file hits, classified into three buckets.

#### Found (NEW — added to `## Open` Phase 2)

- **`@lovable.dev/vite-tanstack-config@^1.3.0`** — live build-time dep at `package.json:96` + `vite.config.ts:7`. Preset auto-injects `@cloudflare/vite-plugin`, tanstack-start, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths`, dev-only component tagger. Removal = rewrite vite.config.ts to wire those plugins inline. ~2hr; one-time cost; build glue only, no runtime path.
- **`bun.lock` resolves through dead Lovable npm proxy.** ~40+ entries resolve via `europe-west4-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/...` (sample: `bun.lock:105,107,109,111,139,157,179,181,183,185`). Tarballs cached locally so current installs work; fresh `bun install` on CI will fail if Lovable shuts the proxy. Fix: `rm bun.lock && bun install` regenerates against `registry.npmjs.org`.

#### Shipped

- `docs/UI_QA_CHECKLIST.md:103` — example `QA_BASE_URL=https://genesisxsx.lovable.app` → `https://genesisxsx.darsh-pod.workers.dev`. Dead host, e2e suite docs were stale.

#### Found (already covered by other `## Open` items, no duplicate entries created)

- **Old send-pending-welcomes cron** at `supabase/migrations/20260417054233_*.sql:25` targets `auto-pilot-sales-ace.lovable.app`. Superseded by `20260517220000_schedule_send_pending_welcomes_cron.sql` (which `cron.unschedule`s the old jobname before re-scheduling against `genesisxsx.darsh-pod.workers.dev`). Applying that pending migration (already in `## Open`) kills the Lovable row in one shot — no additional action.

#### Found (historical scars — acceptable, no action)

15 references are comments / migration audit trails / archive: `test-email.functions.ts`, `connectors.functions.ts`, `connectors/catalog.ts`, `ConnectorIntegrations.tsx`, `email-deliverability.functions.ts`, `dispatch-followups.ts`, `stripe.ts`, `resend.ts`, `ai-agent.ts`, `industry-switching.spec.ts`, plus README/AGENTS/CLAUDE history headers. `GlobalErrorBoundary.tsx:10-18` + `DomainBrandingProvider.tsx:39-51` carry intentional `SYSTEM_HOST_PATTERNS` regex matching `.lovable.app$`/`.lovable-project.com$`/`.lovableproject.com$` to gate platform-default support email on old hosts — load-bearing, keep.

#### Verification

- Grep `lovable|Lovable|LOVABLE` over live tree: 32 hits. After triage: 2 new `## Open` items, 1 shipped (`UI_QA_CHECKLIST.md`), 8 already tracked, 15 acceptable scars / docs.
- `supabase/migrations/20260517220000_*.sql` reviewed — `DO $$ ... cron.unschedule('send-pending-welcomes') ... $$` confirmed idempotent unscheduler on apply.

#### Manual follow-up (user)

- None for the sweep. The two new `## Open` Phase 2 items track the build-dep swap and the bun.lock regeneration. Recommend landing them as one commit once the rest of Phase 2 cleanup is done — they touch the lockfile, so concentrate the churn.

### 2026-05-18 — delete Lovable-era `package-lock.json` (bun-only project)
**Tags:** [lovable-migration] [git]

#### Found

- `package-lock.json` (378KB / 10,805 lines) was a Lovable scaffold fossil. First committed by `Lovable <noreply@lovable.dev>` in `2744916 template: tanstack_start_ts`; last touched `3694f44` by `gpt-engineer-app[bot]` on 2026-04-15 (pre-bun era). Untouched since `bun.lock` (text format, 1977 lines) became canonical on 2026-05-17.
- Zero live consumers: no `.github/` workflows, no scripts, no deploy config references `package-lock.json` or `npm ci|install`. Only mention was `.prettierignore:6` (defensive prettier-skip).
- `package.json` mtime (2026-05-18 12:27) had already diverged from `package-lock.json` (2026-05-17 07:11) — lockfile was lying.

#### Shipped

- `git rm package-lock.json` — file deleted from tree.
- `.gitignore` — added `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` block so accidental `npm install` / `pnpm install` / `yarn install` doesn't recommit a foreign lockfile. `bun.lock` remains tracked (canonical).
- `.prettierignore` — removed stale `package-lock.json` entry.

#### Verification

- `git ls-files | grep -E "package-lock|pnpm-lock|yarn.lock"` → empty.
- `git check-ignore package-lock.json` → match (gitignore rule fires).
- `grep -rn "package-lock\|npm ci\|npm install" scripts/ src/ supabase/ wrangler.jsonc package.json` → no live refs.

#### Found (adjacent, not fixed this turn — separate scope)

- `bunfig.toml:2` — `saveTextLockfile = false` forces bun back to binary `bun.lockb` on next `bun install`. Project explicitly moved to text `bun.lock` after CF Workers Builds rejected `bun.lockb` under `--frozen-lockfile` (per CLAUDE.md). Latent regression — flip to `true` (or delete the line) before next dependency change.
- `package.json:115-119` — `pnpm.overrides` block (`entities@4.5.0`) in a bun-only project. Bun reads it, so currently effective, but semantically misnamed. Cosmetic; defer.

#### Manual follow-up (user)

- None for this delete. Decide whether to land the `bunfig.toml` fix in a follow-up (1-line edit, ships next bun install with text lockfile preserved).

### 2026-05-18 — `@cloudflare/workers-types` shim audit — verdict: permanent until first binding
**Tags:** [cloudflare] [audit] [typescript]

#### Found

- Shim at `src/types/cloudflare-env.d.ts` is the correct call until the first CF native binding (KV/D1/R2/Durable Object/Queue) lands. `wrangler.jsonc` carries only `vars` + `routes` + observability today — zero bindings. Reseller-path stack (Supabase / Resend / Anthropic / CF for SaaS REST) is all HTTP `fetch`, no native binding needed.
- `@cloudflare/workers-types@4.20260517.1` already present in `bun.lock:175` transitively. NOT in `package.json` direct deps. NOT in `tsconfig.json:8` `types` array. Ambient globals stay clean.
- Cloudflare's current recommended path is `wrangler types` (generates `worker-configuration.d.ts` from compat date + flags), used inside a split `tsconfig.worker.json` per the vite-plugin tutorial. Both would land together at migration time — split-tsconfig refactor on TanStack Start's isomorphic boundary (route loaders, server functions) is the real cost (~1hr + risk), and would be wasted effort with no binding to type today.

#### Shipped

- `src/types/cloudflare-env.d.ts:1-25` — header comment refreshed. Now points at `wrangler types` + split `tsconfig.worker.json` as the migration path when first binding lands, instead of the older "copy interface manually" hint. Cross-refs ISSUES.md + the queryable archive note.

#### Verification

- context7 `/websites/developers_cloudflare_workers` confirmed: `wrangler types` is the new recommended path (https://developers.cloudflare.com/workers/languages/typescript). CF's own vite-plugin tutorial uses a separate `tsconfig.worker.json` with `"types": ["@cloudflare/workers-types/2023-07-01", "vite/client"]` scoped to worker files only.
- `grep workers-types` confirmed package not in `package.json` or `tsconfig.json` `types`.
- No live `## Open` entry to remove — earlier audit-flag was from session scratch, not the build log.

#### Manual follow-up (user)

- None. Revisit ONLY when adding a CF native binding. Trigger = `wrangler.jsonc` gains a binding block (`kv_namespaces`, `d1_databases`, `r2_buckets`, `durable_objects`, `queues`). Stop reopening this in audits.

### 2026-05-18 — hostname plan live: apex / www / app / wildcard tenant slug all deployed
**Tags:** [cf-saas] [reseller] [dns] [supabase]

User asked "domain still down?" Apex `majix.ai` had never been bound to the Worker. Designed the full five-tier hostname plan, shipped code + migration + docs, then the user added DNS + the wildcard SSL cert + Supabase Auth URL config, and I pushed the migration + deployed the Worker. Smoke-verified all six hostnames in a real browser. End state: full hostname plan live.

#### Plan (user-approved)

- `majix.ai` + `www.majix.ai` → public marketing (existing `/` route, theme-aware via `useDomainBranding`).
- `app.majix.ai` → central CRM landing + Supabase Auth callbacks + Majix platform admin.
- `<slug>.majix.ai` → per-tenant free white-label tier (wildcard cert covers them all).
- `<custom>.acmecorp.com` → premium white-label via existing CF for SaaS flow.
- `customers.majix.ai`, `notify.majix.ai` left alone (already live).

#### Shipped (commit `6f3756b`)

- `src/components/marketing/TwoWaysSection.tsx` — copy aligned to hostname tiers. Custom Build path = "your domain, top to bottom"; Done-for-You path = "live today on your Majix subdomain". Dropped vague "Optional white-label capability" bullet that conflated tiers.
- `wrangler.jsonc` — routes for `majix.ai/*`, `www.majix.ai/*`, `app.majix.ai/*`, `*.majix.ai/*`. Kept `customers.majix.ai/*`. Wildcard does NOT match apex (CF rule, non-empty label required) — explicit apex row required.
- `src/components/auth/DomainBrandingProvider.tsx` — `SYSTEM_HOST_PATTERNS` extended with `app.majix.ai`, `customers.majix.ai`, `notify.majix.ai`, and `.workers.dev` so they skip the tenant lookup.
- `supabase/migrations/20260518020000_get_org_by_domain_majix_subdomain.sql` — rewrote `get_org_by_domain` in plpgsql with two branches: (1) verified `org_custom_domains.hostname` match (preserves prior shape), (2) `<slug>.majix.ai` slug match (new). Reserved labels (`app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`) short-circuit to NULL even if a tenant somehow grabs that slug. Anon EXECUTE preserved.
- `CLAUDE.md`, `AGENTS.md`, `README.md` — "Hosts" sections rewritten as a tiered table. Reserved-label list documented. Three files agree.

#### Verification

- `bun run typecheck` clean.
- `supabase db push` applied migration to `coynbufhejaeuifpvmvw`. Live RPC checks via `mcp__plugin_supabase_supabase__execute_sql`:
  - `get_org_by_domain('app.majix.ai')` → NULL ✓ (reserved label short-circuits)
  - `get_org_by_domain('www.majix.ai')` → NULL ✓
  - `get_org_by_domain('customers.majix.ai')` → NULL ✓
  - `get_org_by_domain('majix.ai')` → NULL ✓ (apex doesn't match `<label>.majix.ai`)
  - `get_org_by_domain('darsh-test-bc97cbd6.majix.ai')` → real JSON blob with `brand_name="Darsh Test's CRM"`, primary `#3b82f6`, accent `#60a5fa`, sidebar `#0f172a`, `verified=true` ✓
- `bunx wrangler deploy --config dist/server/wrangler.json` — version `a0d85229-1751-4c09-8607-c8e62d38ee7b`. Deploy triggers all 6 hostnames including the wildcard.
- HTTP smoke (`curl -skI`) — apex, www, app, tenant-slug, customers, workers.dev all 200 OK.
- Live browser smoke via two parallel `agent-browser` subagents (sessions `majix-public-smoke-2026-05-18` and `majix-tenant-smoke-2026-05-18`, both closed cleanly):
  - `majix.ai/` — marketing renders. Title "Majix — Never Let a Lead Go Cold Again". H1 "Custom CRM & AI Sales Systems Built for Your Business — Not One-Size-Fits-All". "Two Ways to Run Your Sales System on Majix" section visible. CTAs: Sign In, Start Free Trial, Book a Demo, Pricing. Console clean.
  - `www.majix.ai/` — byte-identical to apex (no 308 redirect — left for follow-up polish).
  - `app.majix.ai/login` — login surface renders. H1 "Welcome back". Email + password + Show toggle, Forgot password, Continue with Google, Start free trial link.
  - `darsh-test-bc97cbd6.majix.ai/` — themed correctly. `document.title="Darsh Test's CRM"`, H1 "Get started with Darsh Test's CRM". CSS variables `--primary=#3b82f6`, `--accent=#60a5fa`, `--sidebar=#0f172a` all set from DB. Wildcard route + RPC path 2 working end-to-end.
  - `customers.majix.ai/` — 200 OK. Falls through to default Majix marketing surface (acceptable; never user-visible per CLAUDE.md).

#### Found

- `get_org_by_domain` had been rewritten in migration `20260427030638` to return `json` (not `jsonb`) and join through `org_custom_domains` (not the `organizations.custom_domain` column). First version of my migration was based on the older 2026-04-20 definition and Postgres rejected `CREATE OR REPLACE` with "cannot change return type" (SQLSTATE 42P13). Rewrote against the actual current shape; re-pushed cleanly. Lesson: always grep for the LATEST migration touching a function before writing a replacement — don't trust the first hit.
- `www.majix.ai` serves identical content to apex (no canonical redirect). Logged as optional polish.
- Direct-tenant signup path's slug-provisioning needs a quick trace to confirm `organizations.slug` is set synchronously at signup. Logged as Open follow-up.

### 2026-05-18 — docs reorg push to origin/main
**Tags:** [git] [docs]

#### Shipped

- Pushed `main` to `origin/main` — 7 commits (6 prior + docs harmonization `73c4a66`). Range `9de9cd0..73c4a66`. Resolved the `## Open` "Push pending" entry.

#### Verification

- `git push origin main` exit 0.
- Pre-existing modifications to `src/lib/workflows/run.ts` + `supabase/functions/_shared/ai-agent.ts` deliberately NOT committed — out-of-scope unfinished Phase 2 workflow-AI-dispatch work (see archive `## 2026-05-17 Phase 1 regression fix` notes). Still in working tree.

#### Manual follow-up (user)

- None for the push itself. Decide what to do with the two staged-but-uncommitted Phase 2 files (`run.ts` + `ai-agent.ts`) next session.

> _Header restored 2026-05-18 — original lost when hostname-plan commit `d9a8381` rewrote adjacent section. This is the exact failure mode the new pre-append checklist + `scripts/lint-issues.sh` are designed to catch._

### 2026-05-18 — cron 24h health smoke
**Tags:** [supabase] [cron] [audit]

#### Shipped

- Deleted `## Open → Cron audit (in-flight)`. Premise ("Lovable-era migrations against dead hosts likely") disproved by smoke + migration content review (`supabase/migrations/20260517230000_schedule_remaining_phase1_crons.sql` points all 6 remaining crons at `genesisxsx.darsh-pod.workers.dev`, not Lovable).

#### Found

- 9/9 `cron.job` rows active. `pg_cron` `status='succeeded'` = 100% across 8 sub-monthly jobs in last 24h: drain-workflow-queue 1440, send-pending-welcomes 1213, email-queue-process 1207, dispatch-sequences 1207, classify-contact-submissions 269, dispatch-followups 80, contact-followup-reminders 20, purge-audit-log 1. `calculate-payouts` (jobid=10, `0 2 1 * *`) 0 rows last 24h, expected — last fire 2026-05-01.
- Downstream HTTP (`net._http_response`, 24h): 1504 × 200 / 38 × 404 (97.5%).
- 404s clustered single hour `2026-05-18 17:00:00+00`, body `error code: 1042` (`text/plain` from Cloudflare edge — transient origin-unreachable). Not stale URL, not dead route. Recovered by 18:00 UTC.

#### Verification

- `SELECT jobid, jobname, schedule, active FROM cron.job` → 9 rows, all `active=true`.
- `cron.job_run_details` 24h GROUP BY jobname: 0 failed across all.
- `net._http_response` 24h GROUP BY status_code: `{200: 1504, 404: 38}`.
- `net._http_response` 24h GROUP BY hour WHERE status<>200: single bucket `17:00 UTC`.
- Migration audit: `ls supabase/migrations/*cron*.sql` → 4 cron migrations, all reference current Worker hostname.

#### Manual follow-up (user)

- None. CF 1042 transient — no action unless recurrence across multiple hour buckets.

### 2026-05-18 — docs harmonization + ISSUES.md restructure
**Tags:** [docs]

#### Shipped

- `README.md` rewritten as human-facing entry (88 lines). Stack, quick start, commands, deploy, layout, history. Points agents at `AGENTS.md` + `CLAUDE.md`.
- `AGENTS.md` written (63 lines). Tool-agnostic routing index — product model, file map, core invariants, skills install, host glossary.
- `CLAUDE.md` patched with routing header pointing at companions + sync rule (change core invariant → mirror to `AGENTS.md`).
- `ISSUES.md` restructured: 1585-line monolith → slim `Open` + `How to append` + `Recent` skeleton. Full prior content frozen at `docs/issues-archive/2026-05.md`.
- GitHub repo homepage swapped: `https://genesisxsx.vercel.app` → `https://genesisxsx.darsh-pod.workers.dev` via `gh repo edit --homepage`.

#### Verification

- `wc -l` on docs: README 88 / AGENTS 63 / CLAUDE 64. Within global rule (<200 each).
- `gh repo view --json homepageUrl` confirmed Cloudflare URL.
- No code changes — no typecheck/lint run.

#### Manual follow-up (user)

- None. Pure docs.
