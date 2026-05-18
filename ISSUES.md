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

### Cron audit (in-flight)

- [ ] **Audit remaining `cron.job` rows**: `dispatch-followups`, `contact-followup-reminders`, `dispatch-sequences`, `purge-audit-log`, `calculate-payouts`. Lovable-era migrations against dead hosts likely. Pattern: `20260517220000_schedule_send_pending_welcomes_cron.sql`.

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

### 2026-05-18 — docs reorg push

#### Shipped

- Pushed `main` to `origin/main` — 7 commits (6 prior + docs harmonization `73c4a66`). Range `9de9cd0..73c4a66`. Resolved the `## Open` "Push pending" entry.

#### Verification

- `git push origin main` exit 0.
- Pre-existing modifications to `src/lib/workflows/run.ts` + `supabase/functions/_shared/ai-agent.ts` deliberately NOT committed — out-of-scope unfinished Phase 2 workflow-AI-dispatch work (see archive `## 2026-05-17 Phase 1 regression fix` notes). Still in working tree.

#### Manual follow-up (user)

- None for the push itself. Decide what to do with the two staged-but-uncommitted Phase 2 files (`run.ts` + `ai-agent.ts`) next session.

### 2026-05-18 — cron 24h health smoke

#### Found

- 9/9 `cron.job` rows active. `pg_cron` `status='succeeded'` = 100% across 8 sub-monthly jobs in last 24h: drain-workflow-queue 1440, send-pending-welcomes 1213, email-queue-process 1207, dispatch-sequences 1207, classify-contact-submissions 269, dispatch-followups 80, contact-followup-reminders 20, purge-audit-log 1. `calculate-payouts` (jobid=10, `0 2 1 * *`) 0 rows last 24h, expected — last fire 2026-05-01.
- Downstream HTTP (`net._http_response`, 24h): 1504 × 200 / 38 × 404 (97.5%).
- 404s clustered single hour `2026-05-18 17:00:00+00`, body `error code: 1042` (`text/plain` from Cloudflare edge — transient origin-unreachable). Not stale URL, not dead route. Recovered by 18:00 UTC.

#### Verification

- `SELECT jobid, jobname, schedule, active FROM cron.job` → 9 rows, all `active=true`.
- `cron.job_run_details` 24h GROUP BY jobname: 0 failed across all.
- `net._http_response` 24h GROUP BY status_code: `{200: 1504, 404: 38}`.
- `net._http_response` 24h GROUP BY hour WHERE status<>200: single bucket `17:00 UTC`.

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
