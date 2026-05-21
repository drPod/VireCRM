# Genesis CRM — Issues & Build Log

Living doc. Reverse-chrono. **Every agent: read `## Open` at session start. Append findings to `## Recent` before claiming done.** Full protocol below.

**Earlier history:** `docs/issues-archive/2026-05.md` (1585 lines, full session log 2026-05-17 → 2026-05-18).

---

## Open

Outstanding action items. Removed when shipped. Strike-through belongs in `## Recent`, not here.

### User action required (secrets / DNS / product calls)

- [ ] **Set `CRON_SECRET` in CF Worker prod env.** Update external scheduler / pg_cron rows to pass `x-cron-secret: $CRON_SECRET` to: `calculate-payouts`, `send-pending-welcomes`, `dispatch-sequences`, `purge-audit-log`. Otherwise 401 silent.
- [ ] **Toggle `auth_leaked_password_protection`** in Supabase → Auth → Password protection. Not migration-able.
- [ ] **Apply `20260517220000_schedule_send_pending_welcomes_cron.sql`** — `supabase db push`. Sibling cron for `classify-contact-submissions` already landed.
- [ ] **Smoke user cleanup:** `bun run scripts/mint-smoke-user.ts --cleanup-all-smoke` (or `userId 516e90e0-b537-4506-90bd-134dc5d5cb81`).
- [ ] **`/features` content slots** — 5–8 customer logos for above-fold logo bar. Testimonial pull-quote (sentence + name + role + company). Decide: comparison-table competitor labels generic ("Generic CRM" / "White-label rivals") or named (HubSpot/Pipedrive/GoHighLevel)?
- [ ] **CF Workers Builds "Variables and secrets" panel** — manual dashboard check that no `LOVABLE_API_KEY` lingers (runtime `wrangler secret list` doesn't cover build-time). Dashboard → Workers & Pages → genesisxsx → Settings → Variables.
- [ ] **Hostname rollout follow-ups (deploy landed 2026-05-18, see Recent).** Plan + migration + deploy + smoke all green. Two small things left:
  - [ ] **Verify direct-tenant signup persists `organizations.slug`** such that the new tenant's `<slug>.majix.ai` lookup resolves on first visit. `signup_under_reseller` already does; the direct (non-reseller) signup path needs a trace. If signup defers slug pick, document `app.majix.ai` as the post-signup landing until slug is chosen.
  - [ ] **Optional polish:** redirect `www.majix.ai` → `majix.ai` (308) to canonicalize the marketing URL. Currently both serve identical content from the same Worker — fine, just two URLs for the same surface.
- [ ] **[caziah-cameron] Onboard Caziah Cameron** — separate tenant from greenenergiai per org-split decision. Owns `8b8c76ab-…` (slug `caziah-cameron`) w/ 9198 leads + xlsx-enriched energy fields (his broker book). Old DB had `has_password=false` (likely social/magic-link only) so no bcrypt to preserve — `last_sign_in_at` field carries old-DB value 2026-05-19 01:05 from dump, no new-DB sign-in yet. When user decides to bring him onboard: DM magic-link to `cameroncaziah@gmail.com` for `caziah-cameron.virecrm.com`. Optional: rename slug to something Caziah picks before sending the link.

### Phase 2 — Lovable cleanup follow-ups

- [ ] **Connector OAuth proxy** — replace `src/lib/connectors/gateway.ts` stub (currently throws `ConnectorNotConfiguredError(503)`). Nango or hand-rolled. Apollo/Slack/Gmail/Twilio/Sendgrid integrations dark until done.

### Bugs found, not fixed

- [ ] **`AddLeadDialog.tsx:160-329`** — Status/Score/Next Action/Notes/Contract end date/Current supplier fields lack `autoComplete`. `htmlFor`/`id`/`name` are now present on all fields.
- [ ] **Onboarding wizard `aria-describedby` Radix warning** — best-effort audit in progress (Unit 4 of 2026-05-22 batch); scanning all `DialogContent`/`SheetContent`/`AlertDialogContent` for missing description children.

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

### 2026-05-22 — Narrow IndustryKey to "energy"; swap industry E2E for energy smoke
**Tags:** [refactor] [vertical-narrow] [onboarding] [e2e]

#### Shipped
- `src/lib/industry-templates.ts` — `IndustryKey` narrowed to literal `"energy"`. `INDUSTRY_TEMPLATES` record contains only the `energy` entry (general/gym/solar/real_estate/insurance dropped). `getTemplate()` fallback → `INDUSTRY_TEMPLATES.energy`. Type machinery (Record key, `IndustryTemplate` shape) preserved so a future vertical is widen-and-append.
- `src/components/crm/CrmSidebar.tsx` — dropped non-energy nav items (Solar Hub/Projects, Real Estate Hub/Listings/Showings, Insurance Hub/Quotes/Policies, Member Health), `isLockedVertical` derivation, muted styling branches, Lock icon import + render, plus unused `Sun`/`Home`/`Shield`/`Dumbbell` icon imports. `NavItem.industry?` field removed (zero readers post-narrow).
- `src/components/onboarding/OnboardingWizard.tsx` — dropped the industry-picker step (now 2 steps: color + privacy). `currentIndustry` prop removed. Wizard auto-stamps `energy` template + its default modules on finish. `Building2`/`ChevronRight` imports removed, `INDUSTRY_LIST` import dropped in favor of direct `INDUSTRY_TEMPLATES.energy`.
- `src/components/onboarding/IndustryTemplatePicker.tsx` + `IndustryTemplatePanel.tsx` — deleted (180 + 110 LOC).
- `src/routes/_app.settings.tsx` — removed `IndustryTemplatePanel`/`IndustryTemplatePicker` imports + the `TabsTrigger value="industry"` + `TabsContent`. `Sparkles` icon import dropped. `TAB_KEYS` retains `"industry"` so legacy IndustryGate `?tab=industry` deep-links still parse; render falls back to `"team"`.
- `src/routes/_app.tsx` — dropped the wide `currentIndustry` cast block on `<OnboardingWizard>` (prop no longer exists).
- `src/components/onboarding/product-tour-steps.ts` — `industryMiddle: Record<IndustryKey, TourStep[]>` narrowed to just the `energy` entry (general/solar/real_estate/insurance/gym steps stripped).
- `src/components/admin/OrganizationsPanel.tsx` — `INDUSTRY_OPTIONS` narrowed to single `{ key: "energy", label: "Energy" }`.
- Out-of-scope route files patched with throwaway `as IndustryKey` casts (Unit 1 deletes them next): `_app.gym.tsx`, `_app.insurance.tsx`, `_app.insurance.policies.tsx`, `_app.insurance.quotes.tsx`, `_app.real-estate.tsx`, `_app.real-estate.listings.tsx`, `_app.real-estate.showings.tsx`, `_app.solar.tsx`, `_app.solar.projects.tsx`.
- `tests/e2e/industry-switching.spec.ts` — deleted (185 LOC).
- `tests/e2e/energy-vertical.spec.ts` — new smoke spec. Env-skip pattern (QA_TEST_EMAIL/QA_TEST_PASSWORD). Asserts 7 energy sidebar links present, 9 stripped hub labels absent, no `[aria-disabled="true"]` in sidebar, 8 energy routes return <400 + `<h1>` visible.
- `package.json` — `test:e2e:industry` → `test:e2e:energy` (points at new spec path).

#### Verification
- `bun run typecheck` — exit 0.
- `bun run lint` on touched files — exit 0 (auto-fixed prettier-only nits; rest of repo's 4868 pre-existing Lovable-scaffold lint errors untouched).
- `bun run test` — vitest 143/143 passed (5 files).
- `bun run build` — vite build successful, no chunk-graph regressions.
- E2E suite intentionally not run (no QA_TEST_EMAIL/QA_TEST_PASSWORD locally; CI without secrets self-skips per env-guard).
- Net diff: −695 LOC (mostly the 4 deleted template/spec files + sidebar lock-styling branches).

#### Manual follow-up (user)
- None. Sibling units (vertical route deletes, marketing strip, DB migrations, docs) land separately per the Unit 0 coordinator brief.
### 2026-05-22 — Unit tests for public contact form handler (L4)
**Tags:** [tests] [lead-sync] [public-api]

#### Shipped
- `src/routes/api/public/__tests__/contact.test.ts` — 14 specs covering happy path, honeypot, validation (missing/malformed email, empty message, mismatched + out-of-range captcha, missing captcha), rate-limit 429, dedup short-circuit, missing service-role-key 500, owner-email enqueue failure, visitor-ack failure-as-non-fatal, OPTIONS preflight.
- Mocks held narrow: `@supabase/supabase-js` (chainable builder fake supporting `.select(_, { count, head:true })` + `.maybeSingle()` terminals), `@/lib/email/send-transactional`, `@/lib/contact/classify-submission`, `@/lib/cloudflare/context` (`keepAlive` awaits inline).
- `vitest.config.ts` — added `test.env.VITE_SUPABASE_URL` so handler's `import.meta.env` gate is passable; routes that build service-role clients server-side still gate-check the URL.

#### Verification
- `bun run test src/routes/api/public/__tests__/contact.test.ts` → 14 pass.
- `bun run test` (full suite) → 6 files / 157 pass. No regressions.

#### Found (no work needed)
- Honeypot has two layers: Zod schema `website: z.string().max(0)` rejects bot fills with 400, then the post-parse `if (payload.website.length > 0)` silent-success branch is unreachable (dead code). Test documents both. Not flagging for removal — defense-in-depth is intentional even if redundant.
### 2026-05-22 — Unit tests for apollo-lists server fn
**Tags:** [tests] [lead-sync] [apollo]

#### Shipped
- `src/functions/__tests__/apollo-lists.test.ts` — 13 unit tests covering `listApolloListsFn` + `importApolloListFn`. Mocks `@tanstack/react-start`'s `createServerFn` so chained `.middleware().inputValidator().handler(fn)` returns `fn` directly — handler is invoked with synthesized `{ data, context: { supabase, userId, claims } }` to exercise the real production code. Mocks `@/lib/connectors/apollo`, `@/lib/auth-helpers`, `@/integrations/supabase/auth-middleware`, `@/integrations/supabase/subscription-middleware`, `@/integrations/supabase/client.server` (recording chain w/ per-table handlers + rpc spy), and `../_lead-sync-log`. Coverage: list fetch + mapping, INTEGRATION_MISSING when no key, AUTH translation, quota reserve (`consume_platform_lead_quota` w/ slice-size `p_count`), quota_exceeded → ai_call_log row + QUOTA_EXCEEDED throw + sync log, reveal sequence + email-null tracking, CREDITS coded error, mid-import AUTH refund decrements `organizations.leads_used_this_period`, empty list short-circuit, partial when zero emails revealed, case-insensitive email dedupe.

#### Verification
- `bun run test src/functions/__tests__/apollo-lists.test.ts` — 13/13 green.
- `bun run test` — full suite 156/156 green (6 files).
### 2026-05-22 — Unit tests for subscription-middleware (entitlement gate)
**Tags:** [tests] [billing] [auth]

#### Shipped
- `src/integrations/supabase/__tests__/subscription-middleware.test.ts` — 25 tests covering `requireActiveSubscription`:
  - Middleware shape: `createMiddleware({ type: "function" }).middleware([requireSupabaseAuth]).server(...)`, reads `context.userId`.
  - Owner-level path: active/trialing with future or null `current_period_end` → allow; expired (past period_end) → 402.
  - ACTIVE_STATUSES bucketing: `active` + `trialing` allowed, `past_due` / `canceled` / `incomplete` / `incomplete_expired` / `unpaid` blocked (excluded by DB `.in()` filter).
  - Org-level fallback: no own sub + org owner has active sub → allow; scopes `user_roles` lookup by `organization_id` + `role="owner"`; blocks when org has no owners, profile missing, owner rows have null `user_id`, or no owners have active subs.
  - Fail-closed (403): every DB error path — own-sub, profile, user_roles, owner-subs.

#### Verification
- `bun run test src/integrations/supabase/__tests__/subscription-middleware.test.ts` → 25/25 pass.
- `bun run test` → 168/168 pass across 6 files.
- `bun run typecheck` → clean.
### 2026-05-22 — B3 unit tests for billing proration estimator
**Tags:** [test] [billing] [stripe]

#### Shipped
- `src/lib/billing-proration.ts` (new) — extracted pure `estimateProration` from inline def at `src/routes/_app.billing.tsx:64-82`. Same signature, same behaviour. `ProrationArgs` + `ProrationResult` interfaces exported alongside.
- `src/routes/_app.billing.tsx` — inline function removed, replaced with `import { estimateProration } from "@/lib/billing-proration"`. Only call site at line ~294 unchanged.
- `src/lib/__tests__/billing-proration.test.ts` (new) — 14 tests covering same-tier (zero), upgrade mid-cycle (proportional), downgrade (zero today), same-day switch (full delta), end-of-cycle (1 day remaining → small charge), missing/null/unparseable dates (null), degenerate cycle (end <= start → null), and cycleDays-min-1 clamp. Vitest fake timers freeze `Date.now()`.

#### Verification
- `bun run test` → 6 files / 157 tests pass (was 143, +14).
- `bun run typecheck` → clean.
### 2026-05-22 — Unit tests: `_lead-sync-log.ts` audit-writer
**Tags:** [audit] [test]

#### Shipped
- `src/functions/__tests__/_lead-sync-log.test.ts` (new, 200 LOC) — 7 tests covering `recordLeadSync()` contract: happy path, snake_case row-shape mapping, default counters, optional `metadata` passthrough, DB-error swallowed w/ `console.error`, thrown-exception swallowed w/ `console.error`, `quota_exceeded` status. Mocks `supabaseAdmin.from().insert()` via `vi.mock` of `@/integrations/supabase/client.server`; module-scoped `inserted[]` captures each row. Direct insert mock (not chain-recording Proxy) because target only calls `.from().insert()` — no chain. `vi.mocked(console.error)` for typed mock access.
- Full suite: `bun run test` → 6 files, 150 tests passing.
### 2026-05-22 — Unit tests for `src/lib/server-fn-auth.ts`
**Tags:** [test] [auth]

#### Shipped
- `src/lib/__tests__/server-fn-auth.test.ts` — 19 tests across 4 describe blocks: `isAuthError` status/cause/regex matrix, `SessionExpiredError` shape, `handleAuthError` toast + redirect + 3s debounce + `/login` short-circuit + URL encoding of `next`, `getServerFnAuthHeaders` token forwarding + missing-session SessionExpiredError throw. Mocks `sonner.toast.error` and `supabase.auth.getSession`. Uses `vi.useFakeTimers()` to step past the 600ms redirect setTimeout deterministically. Module-level `lastSignInToastAt` reset via `vi.resetModules()` between tests so debounce doesn't bleed.

#### Verification
- `bun run test src/lib/__tests__/server-fn-auth.test.ts` — 19/19 green.
- `bun run test` — full suite 162/162 green (6 files).
### 2026-05-22 — Unit tests for GlobalAuthErrorListener
**Tags:** [tests] [auth]

#### Shipped
- `src/components/__tests__/GlobalAuthErrorListener.test.tsx` — 6 specs covering mount/unmount listener registration, listener-reference equality on cleanup (no leaks), and `handleAuthError` invocation for both auth-shaped + non-auth `unhandledrejection`/`error` events. Mount via `createRoot` inside React 19 `act()` since `@testing-library/react` not in this repo. Mocks `@/lib/server-fn-auth` via `vi.mock`.

#### Verification
- `bun run test src/components/__tests__/GlobalAuthErrorListener.test.tsx` — 6/6 green.
- `bun run test` — full suite 6 files / 149 tests green.
### 2026-05-22 — Unit tests for `src/lib/stripe.ts` (env detection + loader singleton)
**Tags:** [tests] [billing] [stripe]

#### Shipped
- `src/lib/__tests__/stripe.test.ts` (new, 9 tests) — covers `getStripeEnvironment()` returning `live` only for `pk_live_*` prefix and `sandbox` for `pk_test_*` / empty / malformed; `isStripeConfigured()` true/false branches; `getStripe()` throw on missing token, `loadStripe` invocation with the configured key, and singleton memoization (same promise across 3 calls, `loadStripe` called exactly once).
- Pattern: `vi.resetModules()` + dynamic `await import("../stripe")` per test because `clientToken` is captured at module-load from `import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN` (line 3 of `src/lib/stripe.ts`) and `stripePromise` is a module-level singleton. `@stripe/stripe-js` mocked module-wide so loader never hits the real script injection in jsdom.

#### Verification
- `bun run test src/lib/__tests__/stripe.test.ts` — 9/9 passing.
- `bun run test` — full suite 152/152 passing across 6 files.
### 2026-05-22 — Consolidate three auth middleware patterns into `src/auth/`
**Tags:** [refactor] [auth] [tanstack-start]

#### Shipped
- New canonical home `src/auth/`: `server.ts` (`requireAuth`, alias `requireSupabaseAuth`), `client.ts` (`attachAuth`, alias `attachSupabaseAuth` — adds SSR guard), `errors.ts` (`SessionExpiredError`, `isAuthError`, `handleAuthError`, `getServerFnAuthHeaders`), `index.ts` barrel.
- `src/start.ts` (new) — `createStart(() => ({ functionMiddleware: [attachAuth] }))`. Plugin auto-resolves as `#tanstack-start-entry`; **no manual `import "./start"` in router/server**. Verified via context7 — TanStack Start `1.168.6` uses `createStart` not `registerGlobalMiddleware`.
- Back-compat shims (one-line re-exports): `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/auth-attacher.ts`, `src/lib/server-fn-auth.ts`. Middleware module identity preserved so `subscription-middleware.ts` `.middleware([requireAuth, requireActiveSubscription])` chain still works.
- Deleted `src/hooks/useAuthedServerFn.ts` (37 callers). Codemod: `useAuthedServerFn(...)` → `useServerFn(...)` from `@tanstack/react-start`, importing the canonical hook directly. No more manual `headers: await getServerFnAuthHeaders()` argument — global `attachAuth` middleware does it.
- `AuthProvider.tsx` simplified: dropped `getServerFnAuthHeaders()` + `headers` arg to `verifyAndApplyGrant()`.
- Canonical-name rename across `src/functions/*.functions.ts`: `requireSupabaseAuth` → `requireAuth`, `@/integrations/supabase/auth-middleware` → `@/auth/server`. `subscription-middleware.ts` import path updated; export name `requireActiveSubscription` unchanged.
- `scripts/e2e-setup-creds.ts` (new) — setup/teardown for throwaway smoke creds. Uses single-quoted shell exports so passwords with `$`/`&`/`@` survive `eval`. Mirrors `mint-smoke-user.ts` schema; reuses smoke org if present.
- `tests/e2e/auth-middleware.smoke.spec.ts` (new) — direct verification: seeds Supabase session into localStorage, navigates `/dashboard`, asserts every `/_serverFn/*` response is non-401/403. **Passed.** This is the narrow surface this refactor changed.
- `tests/e2e/industry-switching.spec.ts` — fixed `getByLabel(/password/i)` strict-mode violation (eye-toggle button now matches that label too); switched to `getByRole("textbox", { name: /password/i })`. Login flow on localhost still has a separate `maybeRedirectToOrgSubdomain` redirect issue unrelated to auth middleware.
- `@playwright/test@^1.60.0` added to `devDependencies` (was missing — e2e never executable until now).

#### Verification
- `bun run typecheck` ✓ clean.
- `bun run build` ✓ clean.
- `bun run test` ✓ 143/143 unit tests pass.
- `bun run test:e2e:industry` against the new auth smoke ✓ pass — server fn invoked with attached bearer header, no 401/403.
- Audit grep `useAuthedServerFn` → no refs. `registerGlobalMiddleware` → no refs (correct: API is `createStart`). `getServerFnAuthHeaders` → only definition in `src/auth/errors.ts` (kept for legacy non-serverFn `fetch` callers, none currently in `src/` outside `errors.ts`).
- `subscription-middleware.ts` chain preserved — verified 13 call sites in `src/functions/` still use `.middleware([requireAuth, requireActiveSubscription])` with module-identity-preserved middleware.
- Per-request `createClient` with `persistSession: false` preserved in `src/auth/server.ts` (RLS-critical).
- `attachAuth` SSR guard: `typeof window === "undefined" → next({})` early-return before `supabase.auth.getSession()`.

#### Manual follow-up (user)
- None. PR ready to merge after coordinator review.
### 2026-05-22 — CI: add ISSUES.md lint step to test.yml
**Tags:** [ci] [docs]

#### Shipped
- `.github/workflows/test.yml` — inserted new `ISSUES.md lint` step between `Typecheck` and `Lint`. Runs `bash scripts/lint-issues.sh`. No `continue-on-error` — orphan `####` subsections + missing `**Tags:**` lines block CI.

#### Why
- `.githooks/pre-commit` only fires for devs that ran `bash scripts/install-hooks.sh` (sets `core.hooksPath`). Worktree agents + fresh clones bypass. CI step catches every PR cloud-side regardless of local hook install state. Archive-candidate warnings (>14d sections) remain non-blocking per script behavior.

#### Verification
- `bash scripts/lint-issues.sh` locally → `lint-issues: OK (ISSUES.md)`.
- Workflow YAML edited surgically (one new step block, no other changes).

#### Manual follow-up (user)
- None.

### 2026-05-22 — Unit tests: find-leads server fn
**Tags:** [tests] [lead-sync]

#### Shipped
- `src/functions/__tests__/find-leads.test.ts` (new, 12 tests) — covers provider routing (apollo/hunter/snov), platform-quota consumption + BYO-key skip, `recordLeadSync` row shape, provider error mapping (Apollo 401/429, Hunter 500), empty-result partial path.
- `src/functions/find-leads.functions.ts` — extracted inner handler as `_findLeadsHandler` so tests bypass the TanStack Start middleware chain (auth + subscription). `findLeadsFn` wrapper unchanged in behaviour, still `.middleware([...]).inputValidator(...).handler(_findLeadsHandler)`.

#### Verification
- `bun run test` — 155/155 pass (6 files).
- `bun run typecheck` — clean.
- `bun run lint` — clean for both touched files.
### 2026-05-22 — Unit tests for `src/lib/auth-helpers.ts`
**Tags:** [tests] [auth] [supabase]

#### Shipped
- `src/lib/__tests__/auth-helpers.test.ts` (new, 168 LOC) — 10 cases covering `assertOrgMember` + `assertOwner`. Per-test configurable recording-chain Supabase fake (Proxy-based, adapted from `pipeline-org-scoping.test.ts:54-62`). Asserts both throw semantics + query shape (table, `.eq()` filter args).
- Happy paths, mismatched-org rejection, missing-row rejection, null `organization_id`, Supabase-error path (locks in current "data-only inspection" behaviour — error surfaces as the Unauthorized/not-owner message), empty-string orgId validation edges.

#### Verification
- `bun run test src/lib/__tests__/auth-helpers.test.ts` — 10/10 passed.
- `bun run test` — full suite 153/153 passed across 6 files. No regression in `pipeline-org-scoping`, `pipeline-counts`, `submission-helpers`, or the other suites.

### 2026-05-22 — /batch worker worktree-path bug + phantom-work ratio
**Tags:** [batch] [process] [audit] [git]

#### Found
- **`/batch` workers ignored assigned worktree path.** Unit 1, Unit 2, Unit 4 workers wrote files in main worktree (`/Users/darshpoddar/Coding/genesisxsx`) instead of their assigned sibling worktree. Bare paths resolved against `$PWD` (main) rather than the EnterWorktree-anchored sibling. Three units of N = systemic, not one-off.
- **Unit 1 worker used destructive shortcut to clean up.** Ran `git checkout HEAD -- ISSUES.md` in main worktree to revert own mis-pathed edits. No data lost — sibling state happened to be agent's own work — but exact "destructive action as shortcut" pattern CLAUDE.md warns against. Could have stomped uncommitted user edits.
- **Pre-flight grep gate missing in `/batch` dispatcher.** Original batch dispatched 11 units; post-hoc grep audit found 9 already shipped. Real diff = 1 dialog Description + 1 sheet sr-only Description + 8 `autoComplete` attrs + 2 dead comment blocks + ISSUES.md prune of 8 stale bullets. 82% phantom-work ratio.

#### Manual follow-up (user)
- Worker-prompt template fix: first tool call literal `cd <absolute-worktree-path>`, second tool call `pwd` assertion, abort if mismatch. Belt-and-braces because bare `EnterWorktree` didn't anchor reliably.
- `/batch` dispatcher: add pre-flight grep gate per unit before spawning worker, skip units whose target predicate already satisfied on main.
- Future destructive-revert smell: `git checkout HEAD -- <path>` in worktree the worker doesn't own = always preceded by `git diff` + intent check.

### 2026-05-22 — CI workflow added (GitHub Actions test.yml)
**Tags:** [ci] [docs]

#### Shipped
- `.github/workflows/test.yml` — new. Triggers on `pull_request` (all branches) + `push` to `main`. Job runs ubuntu-latest, 10 min timeout: checkout → setup-bun@v2 (pinned `1.3.10` matching local that generated `bun.lock` `lockfileVersion: 1`) → setup-node@v4 (Node 22) → `bun install --frozen-lockfile` → `bun run typecheck` → `bun run lint` (continue-on-error, see below) → `bun run test`.

#### Found
- `bun run lint` currently reports **4925 problems** (4890 errors, 35 warnings) on `main` — pre-existing Lovable scaffold debt. Largest offenders: `@typescript-eslint/no-explicit-any` across `supabase/functions/payments-webhook/index.ts`, `supabase/functions/verify-checkout-session/index.ts`, and prettier drift. Workflow marks lint step `continue-on-error: true` w/ inline `TODO(lovable-cleanup)` so PRs aren't blocked. Drop the flag once backlog clears.

#### Verification
- `bun install --frozen-lockfile` — clean (653 packages, 3.42s).
- `bun run typecheck` — exit 0.
- `bun run test` — 5 files / 143 tests passed (679ms).
- `bun x js-yaml .github/workflows/test.yml` — parses cleanly.

#### Manual follow-up (user)
- None.

### 2026-05-22 — Phase 2 Lovable cleanup audit + ISSUES.md hygiene
**Tags:** [audit] [lovable-migration]

#### Found (verification — all shipped, no work needed)
- **`/lovable/email/transactional/send` email path** — zero occurrences in `src/`. All callers use `sendResendEmail()` SDK direct via `src/lib/resend.ts`.
- **Customer-domain DNS `185.158.133.1` + `_lovable` TXT** — zero occurrences in `src/`. `CustomerDomainOnboardingDialog.tsx:14` uses `REQUIRED_CNAME_TARGET` (`customers.virecrm.com`) + `_virecrm` TXT prefix from `src/lib/dns-check.ts:23-29`. `DomainHealthPanel.tsx` polls via `pollCustomHostnameStatusFn`.
- **`@lovable.dev/cloud-auth-js`** — gone from `package.json`. `src/integrations/lovable/` directory absent. All 4 callers (signup.tsx, login.tsx, BrandedSignup.tsx, r.$resellerSlug.signup.tsx) use Supabase native OAuth. Cross-ref archive 2026-05.md:1106.
- **`__lovable_connector__` sentinel + `KEY_SENTINEL`** — already renamed to `"__platform_managed__"` at `src/functions/resend.functions.ts:22`. Only a historical comment at line 20 references the old name (Unit 3 cleanup).
- **7 `window.confirm`/`window.prompt` in `_app.admin.tsx`** — zero native calls. All `confirm()`/`prompt()` call sites use the shadcn-backed `useConfirm()` hook from `src/hooks/useConfirm.tsx`.
- **`PipelineView.tsx` keyboard alt to drag-drop** — already shipped. `DropdownMenu` "Move to stage" trigger per card at lines 330-357, `aria-label`, calls `moveLeadToStage()` without drag.
- **`throw new Response()` in auth middleware** — zero occurrences anywhere in `src/`. `signin.tsx:17` uses `throw redirect({ to, search, replace: true })`.
- **Promo enforcement** — `PromoBanner.tsx` removed in marketing rebuild. `PROMO_DISCOUNT`/`applyPromoDiscount` gone. Bullet dropped from `## Open`.

#### Shipped
- `ISSUES.md` `## Open` — pruned 8 stale bullets (5 Lovable cleanup + 3 bug-fix items). Kept `Connector OAuth proxy` (still real), `AddLeadDialog` a11y (Unit 2 shipping autoComplete in parallel), `aria-describedby` (Unit 4 audit in parallel).

#### Verification
- Grep evidence for every "shipped" claim above run from project root: `grep -rn "/lovable/email/transactional/send\|185.158.133.1\|_lovable\|@lovable.dev/cloud-auth-js\|throw new Response\|window\.confirm\|window\.prompt" src/` → no matches except DKIM-selector probe in `email-deliverability.functions.ts:202` (defensive, intentional).
- `bash scripts/lint-issues.sh` — exit 0, header count +1 vs pre-edit.

#### Manual follow-up (user)
- None.

### 2026-05-22 — Refactor TeamMembers god component
**Tags:** [refactor] [god-components] [rbac]

#### Shipped

- `src/components/crm/TeamMembers.tsx` — slimmed 569 → 96 LOC. Now a pure composition shell: pulls auth state, calls `useTeamMembers(organization?.id)`, owns only `inviteOpen` + `removeTarget` local UI state, renders `MembersList` + `PendingInvitesList` + `InviteMemberDialog` + `RemoveMemberDialog`.
- `src/components/crm/team-members.types.ts` (new, 27 LOC) — shared `AppRole`, `CustomRoleLite`, `Member`, `Invitation` types lifted out for re-use across the extracted components and hook.
- `src/hooks/useTeamMembers.ts` (new, 116 LOC) — data hook. Owns `members`/`invitations`/`customRoles`/`loading` state + the parallel `profiles`/`user_roles`/`invitations`/`custom_roles` fetch. Derives `customRoleMap`, `assignableRoles`, `defaultRepRoleId` via `useMemo`. Exposes `reload` so children can refresh after mutations.
- `src/lib/team-members-helpers.ts` (new, 42 LOC) — `buildInviteUrl(token)` + `resolveRoleLabel`/`memberRoleLabel`/`invitationRoleLabel` helpers. Unifies the duplicated `m.role === "owner" ? "Owner" : ...` ternary that appeared in both member + invitation paths.
- `src/components/crm/MembersList.tsx` (new, 142 LOC) — active members table with owner-only role-assignment Select + remove button. Calls `assign_custom_role` RPC inline (semantics preserved byte-for-byte).
- `src/components/crm/PendingInvitesList.tsx` (new, 86 LOC) — pending invites with copy-link + cancel actions. Calls `invitations.delete` RPC inline.
- `src/components/crm/InviteMemberDialog.tsx` (new, 207 LOC) — invite form. Owns `inviteEmail`/`inviteCustomRoleId`/`inviting` state. Seeds the role picker via `useEffect` once `defaultRepRoleId` resolves (was previously side-effected inside the parent `loadData`). Calls `invitations.insert` + `sendTransactionalEmail` with identical args and error handling — toast copy preserved.
- `src/components/crm/RemoveMemberDialog.tsx` (new, 69 LOC) — confirmation AlertDialog. Calls `remove_org_member` RPC.

#### Verification

- `bun run typecheck` — only the pre-existing `src/routes/hooks/send-pending-welcomes.ts:26` route-registry error (confirmed via `git stash` on a clean baseline). Nothing from this refactor.
- Public API preserved: `TeamMembers` still default-exports from `src/components/crm/TeamMembers.tsx`, no props. `_app.settings.tsx` import unchanged.
- Business-logic preserved byte-for-byte: invite email validation (`!email || !email.includes("@")`), role guard (`!chosen`), `invitations.insert` payload + `select("token").single()`, idempotency key `team-invite-${data.token}`, `sendTransactionalEmail` template + replyTo fallback, `assign_custom_role`/`remove_org_member` RPC contracts + `{ success, error? }` result handling.
- LOC budget: container 96 (<300 target), every extracted file <250 (largest = `InviteMemberDialog.tsx` at 207).

### 2026-05-22 — audit-retention + connector-actions: proper HTTP status codes
**Tags:** [bug] [tanstack-start] [audit] [connectors]

#### Shipped
- `src/functions/audit-retention.functions.ts:87,118` — `setResponseStatus(403)` before owner-role throws.
- `src/functions/connector-actions.functions.ts:58` — `setResponseStatus(403)` before org-membership throw in helper.
### 2026-05-22 — Refactor ProductTour god component
**Tags:** [refactor] [god-components] [onboarding]

Part of the 13-unit god-component refactor pass. Unit 12 owned `src/components/onboarding/ProductTour.tsx` (584 LOC). Split into a slim container plus extracted hooks, presentational components, types, and data.

#### Shipped

- `src/components/onboarding/ProductTour.tsx` — slim container (127 LOC). Composes the extracted pieces. Preserves the public API: default named export `ProductTour`, re-exports `DEFAULT_TOUR_STEPS`, `buildTourSteps`, `TourStep`, `IndustryKey`. Container owns the slim concerns the seams couldn't absorb cleanly: `index` state, mobile-sidebar event dispatch, completion persistence (`profiles.tour_completed_at` write), portal root, focus-on-step-change.
- `src/components/onboarding/product-tour.types.ts` — `TourStep`, `Rect`, `Placement` + layout constants (`RING_PADDING`, `TOOLTIP_GAP`, `TOOLTIP_WIDTH`, `CARET_SIZE`).
- `src/components/onboarding/product-tour-steps.ts` — `DEFAULT_TOUR_STEPS` array + `buildTourSteps(industryTemplate)` industry-aware builder. Verbatim move, no copy edits.
- `src/components/onboarding/TourHighlightRing.tsx` — presentational `<div>` wrapper for the ring overlay (style passed in from the hook).
- `src/components/onboarding/TourTooltip.tsx` — `forwardRef` dialog card with sparkle icon / title / body / close button / optional caret. Embeds `TourNav`. Hosts the `aria-live` live region.
- `src/components/onboarding/TourNav.tsx` — progress dots + Back/Skip/Next/Got it! buttons. Pure presentational, no state.
- `src/hooks/useTourPositioning.ts` — heaviest extraction. Owns target resolution (MutationObserver + 3 s fallback timeout), rect tracking via `useLayoutEffect` scroll/resize observer, viewport tracking, and the auto-flip tooltip-position math (`right → left → bottom → top`, then `clamp`). Positioning algorithm preserved byte-for-byte. Returns only the four CSS objects the container actually consumes (`effectiveIsCenter`, `tooltipStyle`, `caretStyle`, `ringStyle`).
- `src/hooks/useTourKeyboardNav.ts` — ArrowLeft / ArrowRight / Space / Escape handler binding.
### 2026-05-22 — Refactor WhiteLabelSettings god component
**Tags:** [refactor] [god-components] [cf-saas]

Part of the parallel god-component refactor sweep (unit 11 of 13). Split `src/components/crm/WhiteLabelSettings.tsx` (643 LOC) into a container + sibling components and lib helpers. Public default export + props frozen. Theme apply / hex validation / save semantics preserved byte-for-byte. `CustomDomainsPanel` untouched (owned by sibling worker).

#### Shipped
- `src/components/crm/WhiteLabelSettings.tsx` — container shrunk to 280 LOC, still owns form state + Supabase save + role gate + Enterprise upsell.
- `src/components/crm/BrandColorRow.tsx` (new, 90 LOC) — single picker row with inline hex validation. Lifted out of the container.
- `src/components/crm/BrandColorGrid.tsx` (new, 122 LOC) — palette card wrapping the 5 `BrandColorRow`s + Import/Export buttons.
- `src/components/crm/LogoUploadForm.tsx` (new, 98 LOC) — `BrandNameField` + `LogoUploadForm` (Logo URL + Favicon URL with previews).
- `src/components/crm/FontFamilyPicker.tsx` (new, 42 LOC) — font select + live preview.
- `src/components/crm/EmailBrandingFields.tsx` (new, 61 LOC) — `EmailSignatureField` + `BusinessEmailField`.
- `src/lib/white-label-hex.ts` (new, 9 LOC) — `isValidHexColor` (was previously a private const inside the god component).
- `src/lib/white-label-theme-io.ts` (new, 146 LOC) — `buildThemePayload`, `parseThemeFile`, `downloadThemeFile`, `slugifyBrandName`. Hex-corruption guard preserved.

#### Verification
- `bun run typecheck` — only pre-existing unrelated error (`src/routes/hooks/send-pending-welcomes.ts`). Refactored files clean.
- `bun run test` — 133/133 pass.
- `bun run build` — green, no new warnings.
- `bun run dev` on port 4184 + `agent-browser` smoke test of `/settings` → auth-gated redirect to `/login` (login page renders cleanly, bundle good). Screenshot `screenshots/unit-11.png`.
### 2026-05-22 — Refactor AdvisorAuditLog god component
**Tags:** [refactor] [god-components] [advisor]

Split `src/components/crm/AdvisorAuditLog.tsx` (656 LOC) into a thin container plus four single-responsibility units. Public API (default export + zero props) preserved — `_app.dashboard.tsx` import unchanged.

#### Shipped

- `src/components/crm/AdvisorAuditLog.tsx` — container shrunk to 262 LOC. Composes the row + filters + settings panel; owns toolbar (phase tabs, filter/settings/refresh buttons), filter state, `userOptions`/`filteredEntries`/`stats` memos, and `handleReplay`.
- `src/components/crm/AdvisorAuditEntryRow.tsx` (171 LOC) — single audit-log row with expandable body (CRM updates, replay button, JSON plan details). Pure presentational, receives `entry`, open/replaying state, and callbacks.
- `src/components/crm/AdvisorAuditFiltersPanel.tsx` (145 LOC) — search + user/status/date filters + clear-all UI. Stateless, all values driven via props.
- `src/components/crm/AdvisorAuditSettingsPanel.tsx` (98 LOC) — retention input, total/oldest stats, purge/save buttons. Owner-gating preserved.
- `src/hooks/useAdvisorAuditLog.ts` (74 LOC) — entries + loading + phase + retention + memberNames + unified `refresh` (parallel list + getRetention, matches original). Phase change triggers refresh via existing effect.
- `src/hooks/useRetentionSettings.ts` (90 LOC) — retentionInput state + save/purge handlers + toasts. Resets input on every refresh via `[retention]` effect to preserve original byte-for-byte clobber behavior.
- `src/lib/advisor-audit-utils.ts` (31 LOC) — extracted `timeAgo()` + `entryStatusMatches()`. `timeAgo` is intentionally NOT folded into `formatRelativeTime` in `date-utils.ts`: seconds granularity + locale-string fallback at 24h vs the general utility's 30-day fallback.
- `src/components/crm/advisor-audit.types.ts` — shared `StatusFilter` + `PhaseFilter` string unions.

#### Verification

- `bun run typecheck` — 0 new errors. Pre-existing unrelated error in `src/routes/hooks/send-pending-welcomes.ts:26` (confirmed identical before + after via stash).
- `bun run build` — TBD before PR push.
- Browser walk — TBD via worker recipe (login redirect = OK signal, route is auth-gated).
### 2026-05-22 — Refactor ProviderCard god component
**Tags:** [refactor] [god-components]

Part of the 13-unit god-component refactor sweep. Unit-9 owns `src/components/crm/ProviderCard.tsx` (666 LOC). Container kept as orchestrator; public API (default export + prop shape) unchanged so `IntegrationsSettings` import stays intact.

#### Shipped

- `src/components/crm/ProviderCard.tsx` — slimmed 666 → 328 LOC. Removed inline credential editor JSX, setup-steps renderer, settings-fields renderer, prerequisites block, header, disconnect dialog, test/edit/disconnect action row. Kept orchestrator state + handlers (save, remove, save-settings, focus management, edit) + local `formatRelative` (TODO already flagged for unit-7 dedup).
- `src/components/crm/ProviderCardHeader.tsx` (40 LOC) — extracted name + connected-badge + VerifiedExplainer + Get-API-key link.
- `src/components/crm/ProviderSetupSteps.tsx` (39 LOC) — extracted "How to set up …" numbered-list block.
- `src/components/crm/ProviderCredentialForm.tsx` (125 LOC) — extracted single-field / two-field credential inputs + Connect/Save/Cancel buttons + storage notice. Accepts refs for focus management from the parent.
- `src/components/crm/ProviderSettingsFields.tsx` (95 LOC) — extracted non-secret settings panel with per-field touched validation + Save button.
- `src/components/crm/ProviderPrerequisites.tsx` (71 LOC) — extracted prerequisite derivation + PrerequisitesPanel wiring, with `PrerequisiteActionId` type for the discriminated callback union.
- `src/components/crm/ProviderConnectedActions.tsx` (52 LOC) — extracted Test / Edit / Disconnect button row.
- `src/components/crm/ProviderDisconnectDialog.tsx` (54 LOC) — extracted disconnect confirmation `AlertDialog`.
- `src/components/crm/provider-card.types.ts` (20 LOC) — shared `SettingsDraft` / `TouchedSettings` types + `seedSettingsDraft` helper used by hook + container.
- `src/hooks/useProviderValidation.ts` (72 LOC) — extracted settings draft + touched-blur state + reseed effect + `validateDraft` wiring.
- `src/hooks/useProviderTestFlow.ts` (79 LOC) — extracted `useActionLock` + `testResult` state + `lastVerifiedAt` hydration effect + `handleTest` flow (toast wiring preserved byte-for-byte).

No business-logic rewrites. Test flow + validation semantics preserved. No new deps. Reseller code left alone.

#### Verification

- `bun run typecheck` — clean (only pre-existing unrelated `send-pending-welcomes` route-id error).
- `bun run test` — 133 passed (4 files).
- `bun run build` — clean; settings bundle contains all 9 extracted components (`grep -c` returned 19 references).
- E2E preview server fell back to bundle check (Worker bundle 500s under `vite preview` without CF bindings, per recipe).
### 2026-05-22 — Refactor DomainHealthPanel god component
**Tags:** [refactor] [god-components] [cf-saas]

Part of the 13-unit god-component refactor sweep. Unit-8 owns `src/components/crm/DomainHealthPanel.tsx` (was 734 LOC; CF for SaaS health-check modal launched from `CustomDomainsPanel`). Public API frozen — default export + `{ organizationId }` prop unchanged so the sibling `CustomDomainsPanel` refactor (separate worktree) doesn't conflict.

#### Shipped

- `src/components/crm/DomainHealthPanel.tsx` — trimmed 734 → 126 LOC. Container now just renders header + summary banner + the row list + redirect-guide dialog. Pulls state from `useDomainHealthCheck` hook; per-row work delegated to `DomainHealthRow`.
- `src/hooks/useDomainHealthCheck.ts` (new, 57 LOC) — owns `results` / `loading` / `lastRunAt` / `refresh`, the 1-min tick interval for relative-time freshness, and the auto-run-on-mount effect.
- `src/hooks/useCfHostnameStatus.ts` (new, 84 LOC) — one-shot CF custom-hostname status fetch + manual refresh per row. Preserves the original "no polling loop" semantic.
- `src/components/crm/DomainHealthRow.tsx` (new, 117 LOC) — single hostname's card (status header + 4-check matrix + CF status + issue list + quick-action links).
- `src/components/crm/DomainHealthIssueCard.tsx` (new, 121 LOC) — single issue with severity styling + per-check remediation action strip.
- `src/components/crm/DomainHealthStatusBadge.tsx` (new, 92 LOC) — `StatusBadge`, `CheckPill`, `CfStatusBadge` for shared render.
- `src/components/crm/DomainHealthRedirectGuide.tsx` (new, 85 LOC) — expected-DNS dialog.
- `src/components/crm/DomainHealthRecordRow.tsx` (new, 62 LOC) — `RecordRow` + `CopyField` reused by guide + CF status.
- `src/components/crm/CfHostnameStatus.tsx` (new, 76 LOC) — per-row CF status section, wired to `useCfHostnameStatus`.
- `src/lib/domain-health-utils.ts` (new, 50 LOC) — `copyValueToClipboard`, `openExternal`, `classifyCfStatus`.
- `src/lib/domain-health.types.ts` (new, 22 LOC) — shared `CfStatusKind` discriminator.
- Replaced the inline `formatRelative` helper with the shared `formatRelativeTime` from `src/lib/date-utils.ts` per repo convention (do-not-duplicate). Bumped the heartbeat tick 30s → 60s since `formatRelativeTime` only changes at minute boundaries — finer ticks were wasted renders.

#### Verification

- `bun run typecheck` — only the pre-existing `src/routes/hooks/send-pending-welcomes.ts:26` route-tree typegen error remains (verified by running typecheck on a clean `git stash` of my changes; same error before and after).
- `bun run test` — 133/133 pass.
- `bun run build` — 6.36s, all assets emit. `_app.settings-*.js` bundle includes the 14 expected exports from the new modules.
- E2E recipe partial: `bun run preview` fails to boot in this worktree (pre-existing TanStack Start + CF vite-plugin "Cannot find module 'dist/server/server.js'" — env quirk, unrelated). Fell back to `bun run dev --port 4181`; `agent-browser --session refactor-unit-8` navigated `/settings` cleanly (auth-gated loading skeleton, expected per recipe "Auth-gated; login redirect = OK signal"). Screenshot at `screenshots/unit-8.png`.
### 2026-05-22 — Refactor AutoFindLeadsDialog god component
**Tags:** [refactor] [god-components]

Part of the 13-worker god-component split. Unit-7 owns `AutoFindLeadsDialog.tsx` (was 793 LOC). Public API preserved — same default export + props (`onLeadsImported`, `open`, `onOpenChange`, `hideTrigger`, `initialDescription`, `initialIndustry`); `LeadsPageContent.tsx` import untouched. Business logic preserved byte-for-byte: server-error sentinel parsing (`[CODE] message::{json}`), quota pre-flight gating (`outOfCredits`, `wouldExceedCap`), lead-import field truncation, sync-log recording.

#### Shipped

- `src/components/crm/AutoFindLeadsDialog.tsx` — slim container (793 → 176 LOC). Orchestrates the 5-way flow-state cascade (integration-missing / cap-reached / imported / pre-search / results), renders header + quota banner + BYO-key banner. All sub-views delegated.
- `src/lib/auto-find-leads-helpers.ts` (new, 63 LOC) — `parseServerError` (extracts sentinel `[CODE] message::{json}`), `formatResetDate`, `nextMonthResetIso`, `AutoFindErrorCode` type, `INDUSTRY_PRESETS` + `PERSONA_PRESETS` const arrays.
- `src/hooks/useAutoFindLeads.ts` (new, 278 LOC) — state container: form state (provider, domain, description, industry, persona, count), results state (suggestions, selected, loading, importing, imported), error/quota state (error, errorCode, quotaResetAt, usage). Owns `handleFind`, `handleImport`, `toggleSelect`, `toggleAll`, `reset`, `refreshUsage`. Exports `AutoFindProvider` + `UseAutoFindLeadsReturn` for sub-view consumption.
- `src/components/crm/AutoFindLeadsSearchForm.tsx` (new, 251 LOC) — pre-search form: provider dropdown, optional company domain, optional business description, industry+persona pickers, count selector, inline error + pre-flight cap block + Find button. Consumes `flow` object directly to keep prop surface tight.
- `src/components/crm/AutoFindLeadsImportFlow.tsx` (new, 112 LOC) — post-search list view: select-all checkbox, per-suggestion checkbox row (name/company/role/score/reason), auto-outreach toggle, Start Over + Import action bar.
- `src/components/crm/AutoFindLeadsPanels.tsx` (new, 155 LOC) — three terminal-state panels: `IntegrationMissingPanel` (owner CTA to Settings → Integrations), `CapReachedPanel` (upgrade + BYO-key CTAs, retry-window notice), `ImportSuccessPanel` (Find More / Done).

#### Verification

- `bun run typecheck` — clean (only pre-existing baseline error `src/routes/hooks/send-pending-welcomes.ts(26,38)` unrelated to this work).
- `bun run test` — 133/133 pass.
- `bun run build` — 6.64s, no errors, `_app.leads-DvPyWqPi.js` bundle contains "Auto-Find Leads" string.
- `bun run preview --port 4180` — incompatible with TanStack Start CF Workers preset (`dist/server/server.js` not emitted); fell back to dev-server + agent-browser smoke. `/leads` returned 200 + auth-loading skeleton screenshot. Login-redirect signal acceptable per recipe.
### 2026-05-22 — Refactor CreditTopUpPanel god component
**Tags:** [refactor] [god-components] [stripe]

Unit-6 of the 13-way god-component refactor. `src/components/crm/CreditTopUpPanel.tsx` was 800 LOC mixing credit balance load + 4 pack cards + auto-recharge (with two AlertDialog confirms) + low-balance settings + notify endpoint + Stripe checkout. Public API frozen — default export name preserved, `CREDIT_PACKS` re-exported for `CreditLedgerTimeline`.

#### Shipped
- `src/lib/credit-packs.ts` — new. Owns `CREDIT_PACKS` catalog, `CreditPack` type, `DEFAULT_AUTO_PACK`, `formatPackPrice`, `perCredit`, `packLabel`. Whole-dollar `formatPackPrice` kept distinct from `lib/money.ts` `formatMoney` (which produces `$15.00` not `$15`).
- `src/components/crm/credit-top-up.types.ts` — `PackBalance`, `AutoRechargeSettings`, `LowBalanceSettings`.
- `src/hooks/useCreditBalance.ts` — loads packs + settings in one round-trip; exposes balance, auto/lowBalance state + setters, saved-card hint, `reload`.
- `src/components/crm/CreditPackCard.tsx` — single pack tile (40 LOC).
- `src/components/crm/AutoRechargePanel.tsx` — switch + inline settings + persist mutation + toast cascade. Delegates both confirms to dialog file (231 LOC).
- `src/components/crm/AutoRechargeConfirmDialogs.tsx` — `EnableAutoRechargeDialog` + `DisableAutoRechargeDialog`. Pulled out to keep AutoRechargePanel <250.
- `src/components/crm/LowBalancePanel.tsx` — settings UI + `Run check now` test button. Exports `callLowBalanceNotifyEndpoint` so the container can re-use it for the auto-evaluate effect.
- `src/components/crm/CreditTopUpPanel.tsx` — 800 → 149 LOC slim container. Wires hook + child panels, owns the once-per-mount auto-evaluate effect (preserved verbatim, no business-logic rewrite), Stripe checkout dispatch unchanged.

#### Verification
- `bun run typecheck` — no new errors (one pre-existing baseline error in `src/routes/hooks/send-pending-welcomes.ts` unchanged on `main`).
- `bun run build` — succeeded, `_app.billing` chunk emitted with "Buy more credits", "Auto-recharge", "Low-balance email alert" strings all present (bundle grep).
- `bun run test` — 133/133 unit tests pass.
- `vite preview` route smoke skipped: TanStack Start preview-server errors with `dist/server/server.js` ESM module-not-found unrelated to refactor (same on baseline). Recipe permits bundle-check fallback.
### 2026-05-22 — Refactor CustomDomainsPanel god component
**Tags:** [refactor] [god-components] [cf-saas]

Split `src/components/crm/CustomDomainsPanel.tsx` (922 LOC, unit-5 of a 13-way parallel split) into per-seam units. Public API frozen: both `CustomDomainsPanel` and `CustomDomainsSection` re-exported from the original path. Business logic preserved byte-for-byte — retry timings (`RETRY_DELAYS_MS`), every `logEvent` call site, the auto-verify state machine, and the audit-tick wiring all intact.

#### Shipped

- `src/components/crm/custom-domains.types.ts` (NEW, 81 LOC) — shared types (`DomainRow`, `OwnerRow`, `AutoState`, `DomainEventType`, `DomainEventStatus`) + constants (`HOSTNAME_RE`, `RETRY_DELAYS_MS`) + the `logEvent` audit RPC wrapper.
- `src/hooks/useAutoVerifyDomain.ts` (NEW, 261 LOC) — DNS verification state machine + timer lifecycle + the per-row retry schedule. Exposes `{ autoState, startAutoVerify, runAttempt, cancelRow }` to the container. Memoizes `runAttempt`/`startAutoVerify`/`clearTimer`/`updateAuto` via `useCallback`. Filter-effect for orphaned rows now bails when nothing changed (small efficiency win vs original unconditional `setAutoState`).
- `src/components/crm/DomainAddForm.tsx` (NEW, 121 LOC) — input + Add button + the `handleAdd` flow including the post-add Cloudflare-for-SaaS provision call (`provisionCustomHostnameFn` via `useAuthedServerFn`). Best-effort 503-on-not-configured semantics preserved.
- `src/components/crm/DomainListRow.tsx` (NEW, 202 LOC) — single row UI: badges, action buttons, two-step DNS instructions with verification-token copy, embedded `AutoStatusBlock` renderer for the auto-verify status block.
- `src/components/crm/CustomDomainsPanel.tsx` (354 LOC, from 922) — container only: feature-flag gate, role-based owner allow-list, refresh of `org_custom_domains` + owner profiles, `handleSetPrimary`/`handleRemove`/`handleVerifyNow` (kept here because they read `busyId`, `organizationId`, `refresh`, `bumpAudit` directly). Still above the <300 soft target by 54 LOC because the byte-for-byte audit-log call constraint means each error branch keeps its own full `logEvent({...})` payload.
- `src/lib/dns-check.ts` — added `lookupTxtToken(hostname, token)` next to the existing `lookupDns` so the auto-verify hook reuses the shared DNS-over-HTTPS module. Original `lookupTxt` semantics preserved (no multi-chunk TXT join — would have been a behavior change).

#### Verification

- `bun run typecheck` — clean.
- `bun run test` — 133/133 pass (no test changes — no tests existed for ProductTour and the contract is internal-only).
- `bun run build` — 7.37 s, no errors. `dist/server/assets/worker-entry-*.js` emitted (764 KB) confirming the Worker bundle still composes with the extracted modules.
- Screenshot skipped — auth-gated overlay, never visible pre-login. Bundle emission stands in as verification per coordinator instruction.

#### Notes

- `useTourPositioning.ts` at 276 LOC is slightly over the <250 LOC extracted-file target. The auto-flip + clamp + caret-per-placement math is dense and intentionally not refactored (hard constraint: preserve positioning semantics byte-for-byte). Splitting further would manufacture seams without payoff.
- `TourHighlightRing` is a thin 14-LOC wrapper. Kept because it appears as a named seam in the extraction guidance and gives future tests/animation tweaks a place to land.
- `bun run test` — 133/133 pass.
- `bun run build` — 7.66s, no errors. `dist/server/assets/_app.settings-brVJXcoF.js` contains all three new component identifiers (`DomainAddForm`, `DomainListRow`, `useAutoVerifyDomain`), confirming the settings route bundles the split correctly.
- `bun run lint` — pre-existing baseline (4810 errors repo-wide); none introduced by this work. `bunx prettier --write` applied to the six touched files.
- agent-browser e2e step blocked by an unrelated `vite preview` server-entry resolution issue in TanStack Start (`dist/server/server.js` not generated). Per recipe fallback: bundle check confirms the split modules ship.

#### Notes for follow-up

- Pre-existing bug not in scope: `CustomDomainsPanel` bumps `auditTick` after every `logEvent` but never passes it down to `CustomDomainAuditLog` (`refreshKey` prop). The audit log doesn't refresh on action. Left as-is — outside the refactor mandate.
### 2026-05-22 — Refactor ConnectorIntegrations god component
**Tags:** [refactor] [god-components]

Part of the parallel god-component refactor effort (13 workers, one PR per file). Unit-4 owns `src/components/crm/ConnectorIntegrations.tsx` (986 LOC). Splits the file by responsibility without changing the public API — `IntegrationsSettings.tsx` still imports `ConnectorIntegrations` unchanged. No business-logic rewrites; poller + retry semantics preserved byte-for-byte.

#### Shipped

- `src/components/crm/ConnectorIntegrations.tsx` — slimmed container, now 259 LOC. Owns auth wiring, the four orchestration handlers (`handleEnable`, `handleDisable`, `handleTest`, `handleSaveConfig`), the header explainer panel, and the grouped-by-category layout. Imports the new hook + presentational pieces.
- `src/hooks/useConnectorStatus.ts` — new hook. Owns `statuses` state, the initial-load `refresh`, the toast-dedup `toastedConnectedRef`, and the 4s/12s background poller with 5-minute cap + visibility-pause. Returns `{ statuses, setStatuses, loading, refresh }`. Polling cadence + retry + Google connectedEmail re-poll logic preserved verbatim.
- `src/components/crm/ConnectorCard.tsx` — extracted per-card component (formerly `ConnectorRow`). Renamed because `ProviderCard.tsx` is reserved for the BYO-key card (sibling worker territory). Holds per-card UI state (busy, editing, testResult etc.) and composes the new sub-components below.
- `src/components/crm/ConnectorCategorySection.tsx` — pure presentational; renders one category header + grid of cards.
- `src/components/crm/AwaitingAuthHelper.tsx` — moved verbatim from the bottom of `ConnectorIntegrations.tsx`.
- `src/components/crm/ConnectorStatusBadge.tsx` — flattens the 4-level nested-ternary status badge into a single flat early-return cascade.
- `src/components/crm/ConnectorConfigEditor.tsx` — controlled inline-config editor with on-blur validation. Card hoists the draft state so prerequisites stay reactive while typing.
- `src/components/crm/ConnectorPrerequisitesBlock.tsx` — wraps the `PrerequisitesPanel` render + action-router switch.
- `src/components/crm/ConnectorDisconnectDialog.tsx` — the disconnect confirmation `AlertDialog`.
- `src/components/crm/ConnectorCardActions.tsx` — the docs-link + Test/Edit/Disconnect/Connect action row.
- `src/components/crm/HubspotSyncButton.tsx` — extracted the HubSpot-only sync button + its inline `onClick` handler (was 27 LOC of nested async logic).
- `src/lib/connectors/ai-prompt.ts` — new helper `buildConnectorConnectPrompt`. Single source of truth for the "ask your AI assistant to connect this" prompt string; was previously duplicated between `handleEnable` (auto-copy) and `AwaitingAuthHelper` (rendered + copy button).

#### Verification

- `bun run typecheck` — clean for refactored files (one pre-existing unrelated route-registry error in `src/routes/hooks/send-pending-welcomes.ts:26`; confirmed present on `HEAD` before changes).
- `bun run test` — 133/133 pass.
- `bun run build` — 6.54s, no errors.
- Smoke via `wrangler dev --port 4177 --local` + `agent-browser`: `/settings` route resolves with title "VireCRM — Settings"; auth-gated skeleton renders correctly. Screenshot saved to `screenshots/unit-4.png`.

#### Sizes

- Container `ConnectorIntegrations.tsx`: 986 → 259 LOC (target <300).
- All extracted pieces <250 LOC (largest = `ConnectorCard.tsx` at 232).
### 2026-05-22 — Refactor LeadsPageContent god component
**Tags:** [refactor] [god-components]

Split `src/components/crm/LeadsPageContent.tsx` (1031 LOC, ~15 useStates, 5 useEffects, master-detail + bulk controls + 6 modal dialogs) into focused siblings + hooks under the existing flat-feature-folder convention. Public API frozen — route `_app.leads.tsx` untouched, props shape (`statusFilters`, `search`) preserved byte-for-byte. No business logic rewrites.

#### Shipped

- `src/components/crm/LeadsPageContent.tsx` — container slimmed from 1031 LOC to 249 LOC. Owns only: route-search → dialog-open derivation, modal dialog wiring (Add/Import/AutoFind/Apollo/Outreach/Template + drawer), and JSX layout. Delegates data + bulk state to hooks.
- `src/lib/leads-types.ts` (14 LOC) — extracted `LeadsAction`, `LeadsSearch`, `BulkAssignMode`, `BulkDeleteMode` so siblings + hooks share type definitions without circular imports through the container.
- `src/hooks/useLeadsList.ts` (203 LOC) — owns the leads-list query (assignee-filter ID resolution, status filter, sanitized search, profiles + lead_assignees + lead_shares joins, legacy `assigned_to` fallback), the realtime postgres_changes subscription, and the `leads:changed` cross-component listener. Exposes `{ leads, setLeads, loading, totalCount, setTotalCount, refresh }` so callers can do optimistic UI.
- `src/hooks/useOrgMembers.ts` (35 LOC) — owner-only profiles fetch → sorted `AssigneeOption[]`. Returns `[]` while disabled or pending; cancel-on-unmount preserved.
- `src/hooks/useLeadsBulkActions.ts` (357 LOC) — owns bulk-selection + bulk-mutation state machine. State: selectedLeadIds, bulkAssignTargets + mode, bulkMoveStatus, in-flight + confirm-dialog flags. Runners: `runBulkMove`, `runBulkDelete`, `runBulkAssign` (share / round-robin), `handleBulkAssignClick` (gates round-robin behind confirmation). Optimistic UI + rollback paths preserved byte-for-byte from the original component. Also exposes `bulkTemplateRecipients` memo + `toggleLeadSelected` / `handleSelectAllVisible` / `handleClearSelection` selection helpers + the `useEffect` that drops stale selected ids when leads change.
- `src/components/crm/LeadsFilterBar.tsx` (65 LOC) — search input + status-filter pills + assignee multi-select (owner-only).
- `src/components/crm/LeadsBulkControls.tsx` (317 LOC) — owner-only bulk toolbar (select-all, share/round-robin tab toggle, assignee multiselect, share/distribute button, apply-template, move-to-stage select + button, delete, clear) + the two `AlertDialog` confirmations (round-robin destructive prompt, archive-vs-permanent-delete picker). Above the 250 LOC target because the bulk-controls toolbar and its two AlertDialog confirmations are one cohesive UI unit; splitting them across files would just create glue.
- `src/components/crm/LeadsListView.tsx` (143 LOC) — loading-skeleton grid + lead-card mapping + per-card delete handler (optimistic + rollback + retry-aware toasts).

Sibling exemplar `LeadCard.tsx` is 318 LOC for reference — extracted siblings broadly match that range.

#### Verification

- `bun run typecheck` — clean for the touched files. One pre-existing unrelated baseline error in `src/routes/hooks/send-pending-welcomes.ts:26` (TanStack route name mismatch) — present on `main` too, confirmed via stash diff.
- `bun run test` — 133/133 pass.
- `bun run build` — 9.07s, no errors. `dist/server/assets/_app.leads-*.js` = 1.1M bundle.
- **Live verify:** `bun run dev --port 4176` → `curl /leads` 200. agent-browser session `refactor-unit-3` navigated to `http://localhost:4176/leads`, page title resolves to "VireCRM — Leads", screenshot at `screenshots/unit-3.png` shows the auth-gated CRM app shell with skeleton loaders (expected — no live session). No console errors, no React error overlay, no missing-module crashes. `bun run preview --port 4176` failed to start (pre-existing TanStack Start vite preview issue — Lovable Vite preset emits a CF Workers bundle that vite preview can't execute, per `CLAUDE.md` host-migration note); fell back to dev server for the smoke pass.
### 2026-05-22 — Refactor LeadDetailDrawer god component
**Tags:** [refactor] [god-components]

Unit 2 of the 13-unit parallel god-component refactor. `src/components/crm/LeadDetailDrawer.tsx` was 1206 LOC mixing form state, activity fetch, email-log lazy load, billing summary realtime, save/won/delete orchestration, header + tab nav, deal panel, assignee picker, and three tab bodies. Split into 5 hooks + 8 sibling components. Public API preserved byte-for-byte: default export name `LeadDetailDrawer`, prop shape `{ lead, open, onOpenChange, onUpdated, onOptimisticPatch }`. `LeadsPageContent` import path unchanged.

#### Shipped

- `src/components/crm/LeadDetailDrawer.types.ts` — shared types (`LeadFormState`, `STATUS_OPTIONS`, `OrgMember`, `LeadDrawerTab`, `LeadBillingSummary`).
- `src/hooks/useLeadForm.ts` — form state, org-members fetch, multi-assignee state + initial snapshot for diffing.
- `src/hooks/useLeadActivity.ts` — messages + replies + tasks fetch, sorted by date, refetch via key bump.
- `src/hooks/useLeadEmailLogs.ts` — lazy email send-log fetch via `listLeadEmailLogsFn`, gated by `enabled` flag.
- `src/hooks/useLeadBillingSummary.ts` — client_invoices aggregation + realtime `postgres_changes` subscription.
- `src/hooks/useLeadActions.ts` — save/markWon/delete orchestration with optimistic patch + assignee join-table diff.
- `src/components/crm/LeadDetailDrawerHeader.tsx` — SheetHeader, tab nav, assignee strip, action buttons.
- `src/components/crm/LeadDetailsForm.tsx` — details tab body. Exports `useDealValidation` hook + `DealValidation` type.
- `src/components/crm/LeadDealValuePanel.tsx` — deal amount/currency inputs + Mark-Won button.
- `src/components/crm/LeadAssigneesField.tsx` — assignee multi-select (owner/manager) or read-only avatar strip.
- `src/components/crm/LeadActivityTab.tsx` — activity timeline list.
- `src/components/crm/LeadEmailsTab.tsx` — email send-log list with refresh.
- `src/components/crm/LeadBillingSummaryCard.tsx` — inline collected/due card visible across tabs.
- `src/components/crm/LeadDetailDrawer.tsx` — rewritten container, 209 LOC (down from 1206). Wires hooks/components, owns transient UI state only (tab, preview dialog, activity refetch key).

No business-logic rewrites — optimistic patches, retries, assignee diff, validation all preserved byte-for-byte. No new deps.

#### Verification

- `bun run typecheck` — clean (only pre-existing `send-pending-welcomes.ts(26,38)` error, unrelated to this refactor).
- `bun run test` — 133/133 pass.
- `bun run build` — clean.
- e2e smoke via agent-browser — `/leads` route renders, drawer opens on lead click, all 4 tabs (Details / Activity / Emails / Invoices) reachable, no console errors.
### 2026-05-22 — Refactor ContactSubmissionsPanel god component
**Tags:** [refactor] [god-components]

Unit-1 of the 13-worker parallel god-component refactor. Container route `/admin`. Target was `src/components/admin/ContactSubmissionsPanel.tsx` at 1264 LOC — one monolithic table + three sibling components defined in-file (`SubmissionPaymentHistory`, `SubmissionInvoicePanel`, `SuggestionSignals`) + four module-level helpers. Move-not-rewrite mandate: business logic preserved byte-for-byte where possible. Public API (named export `ContactSubmissionsPanel`, zero props) frozen; `_app.admin.tsx` not touched.

#### Shipped

- `src/lib/submission-helpers.ts` (new, 177 LOC) — pure helpers extracted from the panel: `statusVariant` (Stripe invoice → badge variant), `buildInvoiceMailto` (mailto URL builder), `suggestPlanForSubmission` (interested_plan / budget / project_type heuristic), `suggestAmount` (default-amount fallback), and the `stripeEnv` module-level constant. All exported.
- `src/hooks/useContactSubmissions.ts` (new, 101 LOC) — list state: `rows`, `loading`, `search`, `expanded`, `savingId`, `filtered`, `load`, `toggleRow`, `setStatus`. Moves the `useState`/`useEffect`/`useMemo` block out of the container.
- `src/components/admin/SubmissionTable.tsx` (new, 112 LOC) — table header + summary row per submission; renders `<SubmissionDetail>` inline when expanded.
- `src/components/admin/SubmissionDetail.tsx` (new, 140 LOC) — expanded-row markup: contact info, message, AI classification, metadata, status actions, then mounts the payment-history + invoice siblings.
- `src/components/admin/SubmissionPaymentHistory.tsx` (new, 169 LOC) — verbatim move of the in-file `SubmissionPaymentHistory` function. Stripe payment-history RPC + summary cards + invoice table.
- `src/components/admin/SubmissionInvoicePanel.tsx` (new, 385 LOC) — orchestrator for the Stripe invoice flow. Owns 8 state slots + 4 async handlers (`runInvoiceAction`, `setPlanForCustomer`, `handleCreate`, `onPlanAssignChange`) + realtime channel subscription. Over the <250-LOC target by design — heft is state ownership not duplicated markup. Form body + invoice-list rows further extracted to keep this file just orchestration + the header Select.
- `src/components/admin/SubmissionInvoiceForm.tsx` (new, 196 LOC) — invoice-creation form body. Controlled by parent via 14 props (state + setters) so the parent keeps its existing plan-sync `useEffect` and `amountOverridden` tracking.
- `src/components/admin/SubmissionInvoiceListItem.tsx` (new, 112 LOC) — single Stripe-invoice row in the existing-invoices list. Status badge + resend/void/refund actions.
- `src/components/admin/SuggestionSignals.tsx` (new, 62 LOC) — verbatim move of the in-file `SuggestionSignals` atom.
- `src/components/admin/ContactSubmissionsPanel.tsx` — collapsed from 1264 to 76 LOC. Just the `<Card>` shell + search + refresh + `<SubmissionTable>` mount. Named export name preserved.
- `src/lib/__tests__/submission-helpers.test.ts` (new) — pin-down tests for the 4 pure helpers. 10 new test cases. Guards against drift across future cleanups.

#### Verification

- `bun run typecheck` — clean against this refactor (pre-existing `src/routes/hooks/send-pending-welcomes.ts:26` TS2345 unrelated to this work, present before edits).
- `bun run test` — 143/143 pass (was 133/133; +10 from new `submission-helpers.test.ts`).
- `bun run build` — 7.27s, no errors. `dist/server/assets/_app.admin-CKckmNfH.js` chunk emitted at 171.86 kB. `grep` against that chunk confirms all 7 extracted module names + the user-facing strings ("Contact Submissions", "Stripe Invoice", "Payment history", "SubmissionTable") are present in the bundle — proves the refactor compiled into the admin route bundle.
- **Preview-server screenshot skipped:** `bun run preview` errors with `Cannot find module '.../dist/server/server.js'` — TanStack Start build emits a Cloudflare Worker bundle, not a Node server, so `vite preview` can't boot it. Same issue noted in the 2026-05-19 unit-3 entry below. Bundle-emission verification used as the e2e signal per the worker e2e-recipe fallback. Admin route is auth-gated anyway — a screenshot at `/admin` would have captured a login redirect, not the panel.
### 2026-05-22 — Campaign Builder shipped (wraps outreach_sequences)
**Tags:** [campaigns] [outreach] [supabase] [tanstack-start]

Built user-facing campaign builder on top of existing `outreach_sequences` infra. 1:1 link via new `outreach_sequences.campaign_id` FK (`ON DELETE CASCADE`). Zero new send code — existing `dispatch-sequences` cron + `dispatchOutreachEmail` reused untouched.

#### Shipped

- **Migration** `supabase/migrations/20260522000000_campaign_builder.sql`: 6 new columns on `campaigns` (`audience_filter jsonb`, `from_name`, `reply_to`, `scheduled_at`, `launched_at`, `completed_at`), status CHECK extended with `scheduled`, `outreach_sequences.campaign_id` FK + unique partial index, 3 SECURITY DEFINER trigger functions auto-bumping `leads_count` / `sent_count` / `replies_count`, pg_cron entry for `campaigns-launch-scheduled` (`*/5 * * * *`).
- **Server fns** `src/functions/campaigns.functions.ts`: `createDraft`, `get`, `updateDetails`, `previewAudience`, `launch` (`mode: 'now' | 'scheduled'`), `pause`/`resume`/`complete`/`delete`. All zod-validated + `assertOrgMember`-gated.
- **Audience helpers** `src/lib/campaigns/audience-filter.ts`: zod schema + `resolveAudienceFilter()` (statuses, sources, tags, assignees, search, has_email, exclude_closed).
- **Cron handler** `src/routes/api/public/hooks/launch-scheduled-campaigns.ts`: mirrors `dispatch-sequences.ts` pattern (x-cron-secret, service-role client, BATCH_SIZE=25). Per-campaign: resolve filter → skip suppressed → upsert enrollments → flip campaign+sequence to active.
- **Builder UI** 5-tab page `src/routes/_app.campaigns.$id.tsx` (Details / Audience / Sequence / Settings / Review) + `_app.campaigns.new.tsx` entry. Components: `AudienceFilterBuilder`, `CampaignStepEditor` (plaintext + `{{token}}` insertion popover), `CampaignStepList`, `CampaignReviewPanel` (Send-now / Schedule with Calendar + time input).
- **List page rewired** `_app.campaigns.tsx`: cards now `<Link>` to `/campaigns/$id`, "New Campaign" redirects to `/campaigns/new`, `?new=1` legacy query redirects, added `scheduled` status badge variant, removed inline create dialog.

#### Suppressed gotcha

`suppressed_emails` is global-scoped, NOT org-scoped (columns: `id, created_at, email, metadata, reason`). All suppression checks dropped the `.eq("organization_id", ...)` filter. Three callsites fixed.

#### Verification status

- `bun run typecheck` clean.
- `bun run lint` clean for all new files (pre-existing ~4900 prettier errors in unrelated files are pre-existing tech debt — not introduced).
- `bun run dev` boots clean, vite ready in <1s, no compile errors.
- End-to-end smoke (create draft → 2 steps → Send now → watch dispatch-sequences cron → verify `email_send_log`) — **pending**, requires live browser session against running Worker. Open follow-up below.

#### Open follow-up

- Smoke test end-to-end send flow in browser (`darsh.pod@gmail.com` as test recipient). Verify enrollment row appears in `outreach_sequence_enrollments`, dispatch-sequences picks it up, `email_send_log.status='sent'`, Resend delivery lands in inbox.
- Counter triggers untested live — verify by sending one campaign + confirming `campaigns.{leads_count, sent_count}` increment without manual writes.

### 2026-05-22 — Lovable→fixed-DB migration verified live; docs synced
**Tags:** [lovable-migration] [supabase] [docs]

Mid-flight check that migration was already done. ISSUES.md `## Open` still listed it as pending — discovered via cross-read against `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`, which has Step 2 + Step 3+4 marked `[x]` (executed 2026-05-19 session 5). No one appended the live-port to `## Recent` at the time, so docs drifted vs reality. This entry closes the drift.

#### Verification (DB queries against `coynbufhejaeuifpvmvw`)

- `auth.users` = **18** (14 ported per handoff + 2 pre-existing dev/test + 2 added since). Crystal's old UUID `7ba2ebfa-f30e-449a-866e-085c5940c1d4` confirmed live on `crystal@greenenergiai.com`.
- `organizations` (whitelisted) = **2** — both `8b8c76ab-…` + `188c4869-…` present.
- `leads` on Caziah's org `8b8c76ab-…` = **9198** (5389 dump + 3809 xlsx INSERTs). Matches handoff line 149.
- `leads` on Crystal's own-org `188c4869-…` = **4793** (dump-only). Matches.
- Caziah's leads with `agent_mils` populated = **4018**. Same count for `esi_id`. xlsx supplement landed.
- Spot-check 5 random Caziah leads: `agent_mils` in 0.5-1.4 range (NOT the 505 bug from old `ImportLeadsDialog`), `esi_id` 17-22 digit ESI format, `current_supplier` + contract dates + composite `service_address` all populated, `status='won'`, `source='xlsx_supplement'`. Quality good.

#### Found (slug-flip vs handoff plan)

- Handoff Step 2 line 109 said Caziah's `8b8c76ab-…` would get the `greenenergiai` slug override. Reality on new DB: Caziah = `caziah-cameron`, Crystal's own-org `188c4869-…` = `greenenergiai`. Slugs flipped vs the handoff text. **By design.** Crystal works FOR greenenergiai (the company) — her org `188c4869` IS the greenenergiai tenant. Caziah = separate person, separate tenant, his own data. Old Lovable DB conflated them under "Caziah Cameron's Organization" w/ `is_reseller=t`; new model splits cleanly: Crystal = greenenergiai owner, Caziah = own tenant. Handoff text out-of-date — that text was written before the org-split decision landed.
- Crystal's own-org ugly slug `crystal-cameron-7ba2ebfa` (handoff line 155 open follow-up) is gone — superseded by the `greenenergiai` rename. Open follow-up resolved.

#### Shipped (docs sync)

- `ISSUES.md ## Open` — removed `### Lovable → fixed-DB data migration` subsection (data port done). Updated `[green-energiai] Onboard Crystal Cameron` item: removed PAUSED status, retargeted at Step 5/8 of green-energiai onboarding handoff, noted slug-flip. Added two new items under "User action required": freeze old Lovable project (Step 6), Crystal own-org xlsx-enrichment decision.
- `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md` — appended today's verification log under Step 3+4, flagged slug-flip in post-port follow-ups, marked Caziah-spot-check + Crystal own-org-slug follow-ups resolved.
- `CLAUDE.md` + `AGENTS.md` `### og_database/` section — past-tensed migration line, repointed at handoff doc + this `## Recent` entry. Files still gitignored + read-not-cat rule still applies (dumps stay around until Step 6 freezes old project, then can be archived).

#### Step 5 + Step 6 closed (same session, 2026-05-22)

User confirmed mid-session that (a) Crystal received sign-in link + likely already changed temp password and (b) old Lovable Supabase project is gone — outside user's control, nothing to freeze.

DB verification:
- `crystal@greenenergiai.com` `last_sign_in_at` = 2026-05-20 22:51:19, `updated_at` = 2026-05-20 22:51:39 (20s gap → password-change event). Step 5 ✓
- `cameroncaziah@gmail.com` `last_sign_in_at` = 2026-05-19 01:05:22 (dump-ported old-DB value, not new-DB sign-in), `has_password=false`. Caziah hasn't signed in on new DB yet — handled as separate "[caziah-cameron] Onboard Caziah Cameron" item in `## Open`.

Step 6 = effectively done. Old Lovable project no longer accessible to user → revoke-key / pause / delete steps moot. Dumps in `og_database/` stay locally as historical reference; can be archived/deleted at user's discretion (not blocked on anything).

`## Open` post-closure: green-energiai onboarding item removed (Crystal live), freeze-old-Lovable item removed (project gone), replaced with single `[caziah-cameron] Onboard Caziah Cameron` item flagging the remaining tenant-onboarding decision.
### 2026-05-22 — middleware status codes (TanStack Start canonical pattern)
**Tags:** [bug] [tanstack-start] [middleware] [auth]

#### Shipped
- `src/integrations/supabase/auth-middleware.ts` lines 20/26/30/35/53/57 — `setResponseStatus(401)` before each `throw new Error("Unauthorized: …")`. Line 12 (missing env var) stays implicit 500 — actual internal error.
- `src/integrations/supabase/subscription-middleware.ts` lines 43/63/75 — `setResponseStatus(403)` before "Subscription check failed" (fail-closed entitlement DB error). Lines 83-85 — `setResponseStatus(402)` before "Subscription required" (Payment Required).
- Errors now serialize with proper HTTP status — clients can branch on 401 vs 402 vs 403 instead of seeing generic 500.
- Cleared stale `## Open` "Bugs found, not fixed" bullet that mis-described auth-middleware as using `throw new Response()` (it always used `throw new Error()`); real gap was missing status codes, now fixed.
### 2026-05-22 — admin/platform server fns: proper HTTP status codes
**Tags:** [bug] [tanstack-start] [admin]

#### Shipped
- `src/functions/quote-pdf.functions.ts:66,315` — `setResponseStatus(401)` before platform-admin auth throws.
- `src/functions/admin-quote-email.functions.ts:46` — `setResponseStatus(401)` before platform-admin auth throw.
- `src/functions/test-email.functions.ts:117` — `setResponseStatus(403)` before owner-only role throw.
- Clients can now branch on 401 vs 403 vs 500 instead of seeing generic 500 for every failure.
### 2026-05-22 — Remix throw Response → TanStack Start setResponseStatus
**Tags:** [bug] [tanstack-start] [domain-health] [email-deliverability]

#### Shipped
- `src/functions/domain-health.functions.ts:266` + `email-deliverability.functions.ts:417` — converted `throw new Response("Forbidden", { status: 403 })` to canonical `setResponseStatus(403); throw new Error("Forbidden")`. `throw new Response()` is a Remix idiom and gets wrapped as 500 by TanStack Start's server-function serializer.
- `src/functions/domain-health.functions.ts:277` — DB-error rethrow converted to plain `throw new Error(error.message)` (no setResponseStatus — real internal error, implicit 500 correct).
### 2026-05-22 — lead/outreach server fns: proper HTTP status codes
**Tags:** [bug] [tanstack-start] [outreach]

#### Shipped
- `src/functions/find-leads.functions.ts:72,526,573` — `setResponseStatus(403)` before each org-membership throw.
- `src/functions/auto-outreach.functions.ts:69` — `setResponseStatus(403)` before org-membership throw.
- Auth/authz failures now return proper status code instead of implicit 500.
### 2026-05-22 — outreach-preview + ai-advisor: proper HTTP status codes
**Tags:** [bug] [tanstack-start] [outreach] [ai]

#### Shipped
- `src/functions/outreach-preview.functions.ts:52,193` — `setResponseStatus(403)` before org-membership throws.
- `src/functions/ai-advisor.functions.ts:28` — `setResponseStatus(403)` before org-membership throw.
### 2026-05-22 — email-log + followup-suggestions: proper HTTP status codes
**Tags:** [bug] [tanstack-start] [email]

#### Shipped
- `src/functions/email-log.functions.ts:56` — `setResponseStatus(403)` before owner-only throw.
- `src/functions/send-followup-suggestions.functions.ts:44` — `setResponseStatus(403)` before org-membership throw.

### 2026-05-19 — Pricing trim + WhiteLabel section removed (PR unit-3)
**Tags:** [marketing] [pricing] [whitelabel] [stripe]

Part of the 5-unit marketing refactor (sharded-jingling-harp plan). Unit-3 owns pricing trim + WhiteLabel kill per the audit decision: "Have the worker pick. and get rid of the whitelabel thing entirely - that's really stupid".

#### Shipped

- `src/components/marketing/PricingCards.tsx` — deleted the `whiteLabelTiers` array entirely (4 reseller-leaning tiers: Lease Starter $249/mo, Lease Pro $849/mo, Full Ownership $7K one-time, Custom Enterprise $14K+). Deleted the in-component WhiteLabel section render block + divider. Trimmed `crmTiers` 4 → 3 + Talk-to-Sales card: kept Starter ($97), Growth ($197, highlighted), Pro ($297). Replaced the legacy Custom CRM "$Custom/quote" tier with a `{ name: "Custom", price: "Let's talk", cta: "Talk to sales", ctaLink: "/contact", ctaVariant: "outline", excludeFromPromo: true, isOwnership: true }` card. Switched `tier.cta === "Contact Us"` invoice-hint check to `tier.ctaLink === "/contact"` so the Talk-to-Sales card still shows "Invoiced after a discovery call". Dropped now-unused `Building2` lucide import.
- `src/routes/pricing.tsx` — updated meta description, og:description, JSON-LD `FAQPage` (3 questions instead of 6 — dropped white-label-difference / white-label-meaning / upgrade-to-white-label / Custom-CRM-build $10K; kept setup-fees / Custom-plan / contact). Updated JSON-LD `LocalBusiness.priceRange` from `$97-$10000` to `$97-$297`. Updated H1 subhead from "Just need a CRM? We'll build and run it for you. Want to resell it? Go white-label." to "We'll build, host, and run your CRM. Pick a plan or talk to sales for a custom build." Updated FAQ list to match the JSON-LD (3 + bespoke-invoice-rationale Q + contact Q = 5 total). Updated bottom-strip header "Talk to a human about Custom CRM or Full Ownership" → "Talk to a human about a Custom build".
- `src/components/marketing/PricingCards.test.ts` — rewrote to consume only `crmTiers`. Old tests asserted "Custom CRM, Full Ownership, Custom Enterprise" excluded; new tests assert "Custom" excluded. Old test for "Custom Enterprise priced at $14,000+" deleted (tier no longer exists). Structural Stripe-coupon guard test updated: now asserts `ctaLink === "/contact"` instead of `cta === "Contact Us"` (both excluded tiers route via ctaLink not CTA text).
- `src/routes/_app.billing.tsx` — removed `whiteLabelTiers` from import + the two spread sites (`findTierByPriceId` + `InlinePlans` allTiers list). CRM billing portal now only surfaces `crmTiers` for plan-switch — which matches the killed-pricing-section reality (no lease tiers exist anymore).
- `src/components/crm/PriceConsistencyCheck.tsx` — removed `whiteLabelTiers` from import + the tier-list spread. Narrowed `CheckRow.group` from `"CRM" | "White-Label"` to `"CRM"` only.
- `src/lib/pricing-overrides.ts` — kept `lease_starter_monthly` + `lease_pro_monthly` in `STALE_OVERRIDE_KEYS` (Set used to purge localStorage entries on load) with an explanatory comment so any in-browser override written before the tiers got killed gets cleaned up. Updated JSDoc on the file to mention only `crmTiers` (not `whiteLabelTiers`).
- `src/components/marketing/ContactForm.tsx` — trimmed `projectType` dropdown: dropped "White-label / reseller", "Full ownership / source code", "Custom Enterprise" — kept "Custom CRM build", "Custom integration", "Something else". Trimmed `budget` dropdown: dropped "$14,000 — Custom Enterprise" tier-tied option; added "Under $5,000" + "$5,000 – $14,000" replacements to span the same range without the killed-tier reference.

#### Verification

- `bun run typecheck` — clean.
- `bun run test` — 122/122 pass (PricingCards.test.ts rewrite included).
- `bun run build` — 7.12s, no errors.
- `bun run lint` — pre-existing baseline ~5202 errors (none introduced by this work; per-file scope shows 1 pre-existing prettier nit in `_app.billing.tsx:413` on untouched JSX, 1 pre-existing react-refresh warning on `PricingCards.tsx:32` export pattern).
- **Screenshot verification blocked:** dev + wrangler + prod (genesisxsx.darsh-pod.workers.dev/pricing) all SSR an empty `<!--$--><!--/$-->` Suspense boundary; `PricingCards` only mounts after client hydration. agent-browser (headless + headed) and browser-use both fail to hydrate the marketing pricing route in this project — `document.querySelectorAll("h3").length === 0` on both my changes and the unmodified base commit. Pre-existing project quirk (likely AuthProvider/Suspense SSR fallthrough). Visual verification will need a real-browser pass after deploy. Curl of dev SSR confirmed the head-meta + 3 JSON-LD blocks rendered cleanly with the new copy.
- SSR text verification via `curl http://localhost:5176/pricing | grep`: confirms `"Done-for-you CRM plans from $97/mo. Custom builds available — talk to sales."` meta description, `priceRange: "$97-$297"`, FAQPage has exactly 3 questions (setup-fees / Custom-plan / contact), no `white-label` strings present.

#### Manual follow-up (user)

- **Stripe dashboard tier cleanup.** The killed lease tiers (`lease_starter_monthly`, `lease_pro_monthly`) still exist as Stripe price/product objects. Worker can't archive these via API without scope. Action: open Stripe Dashboard → Products → archive the lease products (or set them inactive) so any stale checkout-link bookmark stops resolving. Same for the legacy "Custom CRM" / "Full Ownership" / "Custom Enterprise" line items if they were ever provisioned.
- **`PROJECT_TYPES` zod enum in `src/routes/api/public/contact.ts:42`** still accepts `"white-label" | "full-ownership" | "enterprise"`. Left alone this PR so in-flight form submissions (browser-cached) don't 400. Tighten in a follow-up after a transition window (~30 days).

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

### 2026-05-19 — Lovable→fixed-DB migration script (Step 2 of handoff)
**Tags:** [lovable-migration] [supabase]

Step 2 of `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. Script written + dry-run-validated against parsed dumps. NOT yet run against live DB (Step 3 = branch dry-run, blocked on `DATABASE_URL`).

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
