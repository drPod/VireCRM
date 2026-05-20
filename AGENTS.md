# AGENTS.md

Routing index for AI agents (Claude Code, Cursor, Aider, OpenAI Codex, Copilot, etc). Tool-agnostic. Read this first, then jump to relevant file.

## What product is

**Multi-tenant CRM SaaS.** Customers sign up directly with VireCRM. Every row in `organizations` = direct end-tenant of VireCRM. **No reseller layer** — nobody resells CRM. **Not single-tenant. Not SaaS for one company.**

Brand = `virecrm.com` (legacy `majix.ai` parallel during cutover, 308 redirect after 90d ~2026-08-17).

Two tiers per tenant:
- **Free:** auto-provisioned `<slug>.virecrm.com` subdomain at signup.
- **Premium:** own custom hostname (e.g. `crm.acmecorp.com`) via Cloudflare for SaaS — tenants CNAME to `customers.virecrm.com`.

Each tenant: own user pool, own data, own theme (logo, colors, copy), own billing with VireCRM.

### `og_database/` — legacy Lovable Supabase dumps (gitignored, never push)

User dumped the OLD Lovable Supabase project to `og_database/` on 2026-05-19 as source-of-truth for the data migration to the current `coynbufhejaeuifpvmvw` project. Four files: auth dump (47k, 23 users, bcrypt hashes + PII), schema dump (382k), two full dumps (3.4M each, schema + COPY data). **Gitignored — never commit.** Use targeted `grep` / `sed` not `cat` (auth dump is bcrypt PII). Real Green EnergiAi staff (crystal, erica, shelby, mleaverton) + Cameron Caziah live in the old DB. **`cameroncaziah@gmail.com` last signed in to the old project on 2026-05-19 01:05 — old project still live for at least one user. Migration is time-sensitive.** Full plan + Crystal duplicate-account note in `ISSUES.md ## Open` "Lovable → fixed-DB data migration" section.

### Legacy "reseller" code — don't strip in audits

Lovable scaffold left reseller-tier features behind: `is_reseller` org flag, `signup_under_reseller` SQL fn, `reseller_payouts`/`reseller_plans`/`commission_rules`/`commission_earnings` tables, `r/$resellerSlug/signup.tsx` route, `BrandedSignup.tsx`. Not in use today.

**Custom-hostname + white-label surfaces ARE still core** (they power the premium tier directly): `CustomDomainsPanel`, `EditClientWhiteLabelDialog`, `DomainHealthPanel`, `src/functions/custom-hostnames.functions.ts`, `docs/custom-domains/`. Keep these.

Suspect a "reseller-only" file is dead → flag in `ISSUES.md` `## Open` "Lovable cleanup follow-ups" for review. Don't unilaterally delete. Chesterton's fence.

## File map

| File | When to read |
|---|---|
| `ISSUES.md` | **Read `## Open` at session start.** Outstanding items + protocol. Append findings to `## Recent` before claiming done. |
| `README.md` | Setup, commands, deploy, layout. Human-facing entry. |
| `CLAUDE.md` | Project invariants + conventions + gotchas. Claude Code auto-loads; other agents read too. |
| `docs/issues-archive/YYYY-MM.md` | Cold history. Grep on demand for prior context (commits, prior bugs, root causes). |
| `docs/custom-domains/cf-for-saas-setup.md` | Cloudflare for SaaS runbook (premium-tier custom hostnames). |
| `docs/handoffs/` | Phase plans, migration logs (Vercel → CF, Lovable → owned stack). |
| `docs/UI_QA_CHECKLIST.md` | Manual UI QA checklist. |
| `wrangler.jsonc` | Worker config. Routes + vars + Supabase pub key. Secrets via `wrangler secret put`. |
| `supabase/migrations/` | DB schema source of truth. |

## ISSUES.md protocol (non-negotiable)

**At session start:** read `ISSUES.md` `## Open`. Lists: secrets/DNS the user owes, Phase 2 Lovable cleanup follow-ups, bugs found-not-fixed (file:line), verification debts, out-of-scope product calls. Transient categories (push-pending, in-flight audits) appear/vanish as work lands — read the live file.

**During work:**
- Found bug → append entry to `## Recent` (template in `ISSUES.md` "How to append"). Add to `## Open` "Bugs found, not fixed" if not fixing this session.
- Shipped fix → append `### Shipped` entry to `## Recent` with commit sha + verification evidence. Delete corresponding `## Open` item.
- Resolved an `## Open` user-action item → delete from `## Open`, note in `## Recent`.

**Strike-through (`~~…~~`) lives in `## Recent` only.** `## Open` is live state — items are either present or gone.

**Archive cutoff:** sections fully resolved AND >14 days cold → move to `docs/issues-archive/YYYY-MM.md` (append, never rewrite archive, newest on top, tag inline). Update `docs/issues-archive/README.md` table when creating a new month file. Don't let `ISSUES.md` exceed ~500 lines.

**Archive is queryable.** Before re-investigating something that "feels familiar," grep the archive:

```bash
grep -nE '\[cf-saas\]' docs/issues-archive/*.md      # all CF for SaaS work
grep -nE '\[security\]' docs/issues-archive/*.md     # all security passes
grep -n 'DomainHealthPanel' docs/issues-archive/*.md # every touch on a file
grep -n '2444041' docs/issues-archive/*.md           # find session by commit sha
```

Tag glossary + grep recipes + conventions in `docs/issues-archive/README.md`.

## Core invariants

**Vibe-coded origin.** Lovable artifact. Trust nothing existing. Verify before claiming working. Log every finding to `ISSUES.md`.

**Lookups: context7 first, training data never.** Before touching `wrangler.jsonc`, `@cloudflare/vite-plugin`, TanStack Start, Supabase JS, Stripe API, Bun lockfile — hit context7. Burnt-lesson: pushed `bun.lockb` binary, CF rejected ("outdated lockfile version"). context7 would've flagged `bun.lock` text default since Bun 1.2. Don't repeat. **CF platform / Workers questions** → invoke `cloudflare:cloudflare` skill instead. Non-CF libs stay on context7.

**Supabase CLI > MCP.** Prefer `supabase ...` CLI over `mcp__plugin_supabase_supabase__*`. CLI auth via `SUPABASE_ACCESS_TOKEN`. No context-token cost.

**Cloudflare — which thing to invoke (plugin already installed):**
- DNS / zones / CF for SaaS / certs / rules → `mcp__plugin_cloudflare_cloudflare-api__*`
- `wrangler deploy` / `secret put` / `tail` / `dev` → `cloudflare:wrangler` skill, shell out `wrangler`
- Worker code review / authoring `src/server.ts` / `src/functions/*.functions.ts` → `cloudflare:workers-best-practices` skill
- Worker logs + metrics during smoke → `mcp__plugin_cloudflare_cloudflare-observability__*`
- Workers Builds CI status / build logs after push → `mcp__plugin_cloudflare_cloudflare-builds__*`
- Web Vitals / perf → `cloudflare:web-perf` skill
- General platform lookups → `cloudflare:cloudflare` skill

Dashboard clicks last resort. Skipped (loaded but unused here): `cloudflare-bindings` MCP, `cloudflare:agents-sdk`, `cloudflare:sandbox-sdk`, `cloudflare:durable-objects`, `cloudflare:cloudflare-email-service` (Resend, not CF Email), `cloudflare:build-mcp`, `cloudflare:build-agent`.

**Vite env baked at startup.** Edit `.env` → restart dev server. HMR won't pick up env. Stale-env symptom = silent login fail. Use `scripts/restart-dev.sh`.

**Bun lockfile = text.** `bun.lock` (text) yes. `bun.lockb` (binary) no — CF Workers Builds rejects under `--frozen-lockfile`.

**Surgical edits.** Touch request scope only. Don't refactor unbroken code. Match repo conventions over personal preference.

**Root cause, not symptom.** Don't suppress errors. No silent fallbacks — raise loudly. Workaround needed → flag tech debt + `TODO(): remove once X`.

## Skills (Claude Code + others)

Project skills pinned in `skills-lock.json`. Reproduce on fresh clone:

```bash
npx -y skills@latest experimental_install
```

Bundled: TanStack Start/Router/Query/Integration, Stripe (best-practices/projects/upgrade), Resend (`resend`/`react-email`/`email-best-practices`), `web-design-guidelines`. Supabase + shadcn + Vercel + **Cloudflare** ship via Claude Code **plugins** (auto-updated) — don't duplicate via `skills add`. CF plugin routing in Core invariants above — invoke the listed skill/MCP for the listed task, not generic exploration.

## Hosts (don't confuse)

Hostname plan live 2026-05-18 — all five tiers deployed + smoke-verified (200 OK + UI renders).

**Parallel cutover (until ~2026-08-17):** `majix.ai`, `www.majix.ai`, `app.majix.ai`, `customers.majix.ai`, `notify.majix.ai`, `*.majix.ai` continue resolving via additive `wrangler.jsonc` routes. New canonical = `virecrm.com`. After 90d, `majix.ai` zones 308 → `virecrm.com` equivalents.

- `virecrm.com` + `www.virecrm.com` — Public marketing (landing, pricing, `/features`, signup CTA). Both serve same Worker bundle, no redirect between them.
- `app.virecrm.com` — Central CRM landing + Supabase Auth callbacks + VireCRM platform admin (operator surface — manages tenants). All auth redirect URLs configured here.
- `<slug>.virecrm.com` — Per-tenant white-label CRM (free tier). Wildcard Worker route + wildcard Advanced cert (`virecrm.com` + `*.virecrm.com`).
- `<custom>.acmecorp.com` — Per-tenant white-label CRM (premium tier) via existing CF for SaaS flow (CNAME → `customers.virecrm.com`).
- `customers.virecrm.com` — CF for SaaS fallback. Infra-only, never user-visible. If hit directly, serves default VireCRM marketing.
- `notify.virecrm.com` — Resend transactional email sender (live 2026-05-20). DNS verified on Resend; test send delivered. All `SENDER_DOMAIN` + `FROM_DOMAIN` constants in code now point here. `notify.majix.ai` kept verified during parallel cutover (until ~2026-08-17) but no new code path uses it.
- `genesisxsx.darsh-pod.workers.dev` — Worker subdomain, dev/preview escape hatch.

Reserved subdomain labels (never tenant slugs, blocked at both DB + client): `app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`. Enforced in `get_org_by_domain` migration (`20260518020000_…`) + `DomainBrandingProvider.SYSTEM_HOST_PATTERNS`.

Tenant theming pipeline:
1. `DomainBrandingProvider` reads `window.location.hostname` client-side.
2. If host matches system pattern, skip RPC + render default VireCRM theme.
3. Otherwise call `get_org_by_domain(host)` — RPC tries verified custom hostname (`org_custom_domains` join), then `<label>.virecrm.com` slug match (legacy `<label>.majix.ai` accepted same path during parallel cutover). Returns `json` blob or NULL.
4. If blob returned, provider applies CSS variables for primary/secondary/accent/sidebar/button color, plus favicon, font, document title.

Marketing surface + CRM surface share routes — hostname does not change which file renders, only which UI it returns. Marketing pages (`/`, `/pricing`, `/features`, `/contact`, `/signup`) are tenant-theme-aware via `useDomainBranding()`, so hitting `acme.virecrm.com/` shows Acme-branded marketing, not generic VireCRM marketing.

## Verify before claiming done

No "complete"/"fixed"/"passing" without evidence. Run `bun run typecheck` + `bun run lint` + `bun run test`. UI changes → screenshot or live verify. Can't verify → say so. Don't ship optimism.

## Where to append findings

`ISSUES.md` — append at top of `## Recent` (newest first). Format:

```markdown
### YYYY-MM-DD — short title
**Tags:** [tag1] [tag2]

#### Shipped / Found / Verification / Manual follow-up (user)
- file:line — terse caveman OK. Commit `<sha>` if landed.
```

Exact rules + pre-append checklist live in `ISSUES.md` "How to append" — read once per session.

**Enforcement:**

- `bash scripts/lint-issues.sh` — manual lint, run after editing.
- `.githooks/pre-commit` — auto-runs lint on any `git commit` touching `ISSUES.md`. Activate once via `bash scripts/install-hooks.sh` (sets `core.hooksPath=.githooks`). Catches Cursor/Codex/manual edits too.
- `.claude/settings.json` PostToolUse hook — CC-only, fires inline after Edit/Write. Other agents skip this; the git hook is the universal guard.

Lint catches: orphan `####` subsections (no `### YYYY-MM-DD` parent), missing `**Tags:**` line, sessions >14d old in `## Recent` (archive candidate, warning only).
