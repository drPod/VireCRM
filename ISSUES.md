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

- [ ] `/clients` reseller mgmt — single "Enable in Settings" CTA, full UI not wired. ~1-2 days.
- [ ] `/gym` member-health ingest UI — no way to add records. Need ingest UI or auto-populate-from-leads migration.
- [ ] `/gym` doesn't use `IndustryHub` pattern like real-estate/insurance. Extend.
- [ ] `/admin` gated 100% on platform-admin. Add "you would see X if admin" preview for docs.
- [ ] `/dashboard credit usage` tier buttons (Starter/Growth/Pro/Ownership) — verify wiring (render w/o visible data binding).

---

## How to append

Every finding, every fix, every session — append before claiming done.

### Entry template

```markdown
## YYYY-MM-DD — short title

### Shipped (if applicable)
- file:line — what changed. Commit `<sha>` if landed.

### Found (if applicable)
- **file:line** — symptom. Root cause if known.

### Verification
- typecheck / lint / browser walk / e2e — what was actually run. No "passing" without evidence.

### Manual follow-up (user)
- One-line action items needing user hands.
```

### Rules

1. **Newest section on top of `## Recent`.** Push older sections down.
2. **`## Open` = live state.** Outstanding items only. Move shipped items out (leave shipped entry in `## Recent` for context). Never strike-through inside `## Open` — delete instead.
3. **`## Recent` = audit trail.** Strike-through (`~~…~~`) resolutions inline here. Preserve original wording.
4. **Archive cutoff:** move a `## Recent` section to `docs/issues-archive/YYYY-MM.md` when (a) entire section is strikethrough/resolved AND (b) >14 days old. Append to matching month file.
5. **Caveman OK** in prose. Code/error quotes verbatim. File paths + line numbers + commit shas required for any code-touching finding — downstream agents cite them.
6. **Don't dupe across sections.** Open ↔ Recent linkage by file:line; don't restate full context twice.

---

## Recent

Most-recent session at top. Earlier 2026-05-17 / 2026-05-18 sessions in `docs/issues-archive/2026-05.md`.

### 2026-05-18 — `@cloudflare/workers-types` shim audit — verdict: permanent until first binding

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



#### Shipped

- Pushed `main` to `origin/main` — 7 commits (6 prior + docs harmonization `73c4a66`). Range `9de9cd0..73c4a66`. Resolved the `## Open` "Push pending" entry.

#### Verification

- `git push origin main` exit 0.
- Pre-existing modifications to `src/lib/workflows/run.ts` + `supabase/functions/_shared/ai-agent.ts` deliberately NOT committed — out-of-scope unfinished Phase 2 workflow-AI-dispatch work (see archive `## 2026-05-17 Phase 1 regression fix` notes). Still in working tree.

#### Manual follow-up (user)

- None for the push itself. Decide what to do with the two staged-but-uncommitted Phase 2 files (`run.ts` + `ai-agent.ts`) next session.

### 2026-05-18 — cron 24h health smoke

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
