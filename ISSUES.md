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
- [ ] **[green-energiai] Onboard Crystal Cameron + energy-broker CRM build-out** — **PAUSED 2026-05-19.** Steps 0-6 shipped on 2026-05-18 (`30f3a54`, `e0ada67`, `554580a`, `4635496`, `4b6f75e`, `1448353`, `6399b7b`, `286cd81`) but invalidated by 2026-05-19 discovery — old Lovable DB still live, Crystal's auth.users row preserved there (`7ba2ebfa-…`), session-1 provisioning created a DUPLICATE on new DB (`b5ae0c3e-…`), session-2 xlsx-import wrote 3850 rows with broken column mapping. **Migration must run FIRST** (`docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`). Resume Crystal onboarding at Step 5 of `docs/handoffs/2026-05-18-green-energiai-onboarding.md` AFTER migration lands — by then her UUID/password/data already on new DB, energy fields already populated from xlsx supplement pass.

### Lovable → fixed-DB data migration

- [ ] **Migrate live data from old Lovable Supabase project to current `coynbufhejaeuifpvmvw` project.** Full plan in `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. Strategy = enrich, not replace: old DB is truth for users + lead UUIDs; xlsx is supplement for the energy-broker fields the old importer dropped. User dumped the old project to `og_database/` on 2026-05-19 (gitignored, never push — bcrypt password hashes + PII). Contents:
  - `genesis_auth_data.sql` (47k) — 23 `auth.users` rows
  - `genesis_database_schema.sql` (382k) — schema-only
  - `genesis_database_full.sql` (3.4M) — schema + `COPY public.* FROM stdin` data sections
  - `genesis_database_full_with_auth.sql` (3.4M) — everything (auth + public)
  - **Caziah Cameron (`cameroncaziah@gmail.com`) last signed in on the OLD project at 2026-05-19 01:05** — the old project is still live for at least one user. Migration window is short; cut over before a stale-DB writes get lost.
  - **Crystal Cameron (`crystal@greenenergiai.com`) already exists on the OLD project** with `auth.users.id = 7ba2ebfa-f30e-449a-866e-085c5940c1d4` confirmed 2026-04-23 16:37. The 2026-05-18 session-1 provisioning created a DUPLICATE on the new DB with `id = b5ae0c3e-1655-48d5-b211-a9fd55aaafea`. Decide before DM-ing her: either (a) delete the new-DB Crystal and port the old-DB row over (preserves UUID, keeps any historical references) or (b) keep the new-DB Crystal and write off the old account.
  - Real-looking accounts in old DB: 4 `@greenenergiai.com` staff (crystal, erica, shelby, mleaverton), 2 founder addresses (`ethansereti`, `esereti22`), `cameroncaziah`, plus 6 other gmail/personal addresses (`alexanderjakari`, `caziahbankss`, `davioncarr60`, `info.solace05`, `jesaira.lifosjoe12`, `paparusse02`, `primeframem`). Plus 5 test/audit users to skip.
  - Plan TBD: write a one-shot migration script that connects to BOTH projects, transforms old → new schema where shapes diverged (e.g. the energy_broker_fields migration `20260518200618_*` added columns the old DB didn't have), inserts via service-role on new project. Auth-user import via Supabase Admin API (`POST /auth/v1/admin/users` with `password_hash` to preserve bcrypt). Then freeze old project + redirect any lingering DNS.

### Phase 2 — Lovable cleanup follow-ups

- [ ] **Connector OAuth proxy** — replace `src/lib/connectors/gateway.ts` stub (currently throws `ConnectorNotConfiguredError(503)`). Nango or hand-rolled. Apollo/Slack/Gmail/Twilio/Sendgrid integrations dark until done.
- [ ] **Email send path still hits Lovable.** `src/lib/email/send.ts:36`, `src/lib/email/dispatch-outreach.ts`, `src/lib/admin-quote-email.functions.ts:99` POST to `/lovable/email/transactional/send` (dead). Either keep route as Resend SDK shim or rewrite callers direct.
- [ ] **Customer-domain onboarding still points DNS at LOVABLE.** `src/components/crm/CustomerDomainOnboardingDialog.tsx:15,71-90,145` + `src/components/crm/DomainHealthPanel.tsx:33-34,344,435-449` — A-record `185.158.133.1`, `_lovable` TXT. Update to CF Workers target + `_majix` token (migration `20260517170000_rebrand_verification_token_prefix.sql`).
- [ ] **`@lovable.dev/cloud-auth-js`** — social signin (Google/Apple/Microsoft) still routes through it via `src/integrations/lovable/index.ts`. Callers: `BrandedSignup.tsx`, `login.tsx`, `signup.tsx`, `r.$resellerSlug.signup.tsx`. Migrate to Supabase native OAuth providers.
- [ ] **`VerifiedExplainer.tsx:50`** — copy "We asked the Lovable Connector Gateway…" references stubbed gateway. Rewrite.
- [ ] **`ResendSettingsCard.tsx:4` + `resend.functions.ts:4,18,212`** — runtime sentinel `KEY_SENTINEL = "__lovable_connector__"` gates per-org Resend key flow; Phase 1 went direct SDK, likely dead.
- [ ] **`admin-quote-email.functions.ts:97`** — fallback origin hardcoded `https://genesisxsx.lovable.app`. Update to `https://majix.ai`.
- [ ] **`contact-acknowledgment` template** — fallback pricing URL is `https://genesisx.space/pricing` when no `origin` header. Update to `https://majix.ai/pricing`.

### Bugs found, not fixed

- [ ] **`_app.admin.tsx` lines 770, 797, 1821, 1829, 1837, 2058, 2070** — 7 `window.confirm`/`window.prompt` sites for destructive ops. Port to shadcn `AlertDialog` (pattern at same file 2213+).
- [ ] **`AddLeadDialog.tsx:160-329`** — every `<label>` bare (no `htmlFor`), every `<input>` lacks `id`/`name`/`autoComplete`. Primary lead-entry form inaccessible to SR + password managers.
- [ ] **`PipelineView.tsx:286-320`** — drag-and-drop only. No keyboard alternative. Pipeline unreachable via keyboard.
- [ ] **`CrmSidebar.tsx:113-120`** — body-scroll lock effect snapshots `document.body.style.overflow` per render; route change while drawer open can strand `overflow: hidden`. Snapshot on mount only.
- [ ] **`CrmSidebar.tsx:163`** — `void enabledModules;` makes feature-flag module gating non-functional.
- [ ] **`_app.admin.tsx:1340,1354,1888`** — admin invoice email subjects/signatures hardcode "Genesis" / "— Ethan, Genesis". Should be majix branding.
- [ ] **Auth middleware uses `throw new Response()`** — TanStack Start doesn't serialize Response; 401/403 paths wrap as 500. `src/integrations/supabase/auth-middleware.ts`. Currently dead path (Bearer always attached) but blocks future "token expired mid-call" handling.
- [ ] **Promo enforcement** — `PromoBanner` says "first 100 customers only" but `applyPromoDiscount` applies unconditionally. Gate via Stripe coupon `max_redemptions=100` or server-side counter.
- [ ] **Onboarding wizard `aria-describedby` Radix warning** — re-capture w/ Radix stack trace from browser console next session. Candidates: `command.tsx` (`CommandDialog`, dead), `AddLeadDialog.tsx`, `EnergyTablePage.tsx`, `_app.academy.tsx`, `_app.academy.$courseId.tsx`, `_app.contact-submissions.tsx`.
- [ ] **Reputation banner copy** missing from `VIEW_BANNER_COPY` for `reputation` view in `/preview`. Falls through to default fallback.

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

### 2026-05-19 — rebrand unit 4: stripe edge fn CORS allowlist adds virecrm.com
**Tags:** [rebrand] [stripe] [cf-saas]

Parallel-cutover rebrand (Majix → VireCRM). Additive only — both zones live during transition.

#### Shipped

- `supabase/functions/_shared/stripe.ts:84-90` — `ALLOWED_ORIGIN_SUFFIXES` now contains `.virecrm.com` + `virecrm.com` alongside existing `.majix.ai` + `majix.ai` (+ `.workers.dev`, `localhost`). 6 entries total. ACAO fallback on line 106 left as `https://majix.ai` per unit spec — separate cutover concern.

#### Verification

- `bun run typecheck` clean.
- `bun run test` — 123/123 pass.
- `bun run lint` — 5170 pre-existing errors repo-wide; 6 pre-existing in `stripe.ts` (lines 36, 109, 119-124). Edit at lines 84-90 introduces zero new lint findings. Out of unit scope.

### 2026-05-19 — rebrand unit 2: get_org_by_domain dual-zone (majix.ai + virecrm.com)
**Tags:** [rebrand] [supabase] [cf-saas]

Parallel-cutover rebrand work-unit 2 of N (Majix → VireCRM). Goal: keep both parent zones resolving to the same tenant during DNS / cert provisioning on virecrm.com. SQL-only — single new migration that supersedes the prior majix-only definition.

#### Shipped

- `supabase/migrations/20260519100844_get_org_by_domain_virecrm.sql` (new, ~95 lines). `CREATE OR REPLACE FUNCTION public.get_org_by_domain(p_hostname TEXT) RETURNS json` — path 1 (verified custom hostname via `org_custom_domains`) unchanged from `20260518020000_*.sql`; path 2 regex extended from `^[a-z0-9][a-z0-9-]*\.majix\.ai$` to `^[a-z0-9][a-z0-9-]*\.(majix\.ai|virecrm\.com)$`. Reserved-label list (`app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`) unchanged.

#### Verification

- `bun run typecheck` clean.
- `bun run test` — 123/123 passing.
- `bun run lint` — 5210 pre-existing errors across `supabase/functions/_shared/*`, `payments-webhook`, `verify-checkout-session`, `vite.config.ts`. Confirmed identical count with my change stashed; none touch the new migration file (SQL not lint-targeted).
- `grep -nE '(majix\.ai|virecrm\.com)' supabase/migrations/20260519100844_*.sql` — both zones present, including line-65 regex.
- Regex behaviour spot-check (Node): 9/9 cases pass — accepts `greenenergiai.majix.ai`, `greenenergiai.virecrm.com`; rejects `foo.bar.majix.ai`, `foo.example.com`, apex `majix.ai` / `virecrm.com`, leading-dash labels.
- Local supabase stack not running (`supabase status` reports missing container) — skipped `supabase db reset` per work-unit carve-out. Migration applies via `CREATE OR REPLACE` so prod-side push is idempotent.

#### Manual follow-up (user)

- After all rebrand units land, push the migration to prod via `supabase db push` (or CI runner). DNS for virecrm.com + wildcard cert tracked under separate rebrand units.

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
