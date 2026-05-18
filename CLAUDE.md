# genesisxsx

Claude Code conventions + gotchas. Auto-loaded into Claude Code context every session.

**Companions (keep in sync when editing):**
- `README.md` — human entry: setup, commands, deploy, layout
- `AGENTS.md` — tool-agnostic mirror of invariants below (for Cursor / Aider / Codex / Copilot; they don't auto-load this file)
- `ISSUES.md` — living build log; **read `## Open` first, append findings to `## Recent` before claiming done.** Full protocol in `ISSUES.md` "How to append" section.

If you change a core invariant in this file (multi-tenant-no-reseller business model, context7-first, Supabase-CLI > MCP, vite env-bake, bun.lock text, ISSUES.md protocol), mirror the change in `AGENTS.md` so non-Claude agents stay aligned. Surface area is small — drift = different agents acting on different rules.

## ISSUES.md is non-negotiable

Every session, before any other work: read `ISSUES.md` `## Open`. It contains: secrets/DNS the user owes, Phase 2 Lovable-cleanup follow-ups, bugs found-not-fixed (file:line), verification debts, product-call out-of-scope items. Transient categories (push-pending, in-flight audits) appear/vanish as work lands — read the live file.

Every finding (bug discovered, audit result, schema gap) and every fix (commit landed, cron applied, route wired): append a section under `## Recent` using the template in `ISSUES.md` "How to append". Header is `### YYYY-MM-DD — title` (three hashes) with a `**Tags:** [foo] [bar]` line directly below. Strike-through resolved items in `## Recent`; delete from `## Open`.

**Two layers of enforcement — both shipped:**

- **Agent layer** (`.claude/settings.json` PostToolUse hook → `.claude/hooks/lint-issues-on-edit.sh`): fires after every `Edit`/`Write`/`MultiEdit`. Exit 2 surfaces lint errors back inline so the agent can correct same-turn. Project-local, CC-only.
- **Commit layer** (`.githooks/pre-commit` → `scripts/lint-issues.sh`): catches any agent (Cursor, Codex, manual) at commit time. Activate once on fresh clone via `bash scripts/install-hooks.sh` (sets `core.hooksPath=.githooks`).

Manual invocation: `bash scripts/lint-issues.sh`. Catches orphan `####` subsections (real failure mode: commit `d9a8381` stomped a header) + missing tag lines + archive candidates >14d old.

Cold sections (fully resolved AND >14 days old) move to `docs/issues-archive/YYYY-MM.md` (append verbatim, newest on top, tagged inline). Update `docs/issues-archive/README.md` table when creating a new month file. Don't let `ISSUES.md` grow past ~500 lines — archive aggressively.

Archive is queryable corpus: `grep -nE '\[cf-saas\]' docs/issues-archive/*.md` etc. Tag glossary + conventions in `docs/issues-archive/README.md`. Use it before re-investigating something the team already shipped — saves spinning up audits twice.

Vibe-coded on Lovable — trust no existing code, we're here to fix it.

- Vibe-coded original: https://genesisx.space/
- Fixed version (this repo, deployed to Cloudflare Workers): https://genesisxsx.darsh-pod.workers.dev

Host migration history: Vercel was abandoned because the Lovable Vite preset emits a Cloudflare Worker bundle that Vercel can't execute. See ISSUES.md 2026-05-17 Cloudflare migration.

## What this product is (business model)

**Multi-tenant CRM SaaS.** Customers sign up directly with Majix. Each customer = one tenant org. Every tenant gets a white-labeled CRM instance:

- **Free tier:** auto-provisioned `<slug>.majix.ai` subdomain (every tenant at signup).
- **Premium tier:** own custom hostname (e.g. `crm.acmecorp.com`) via Cloudflare for SaaS.

**No reseller layer.** Nobody resells the CRM. Every row in `organizations` = direct end-tenant of Majix. (Examples: Green EnergiAi is a tenant — they sell energy contracts to their own customers, but those customers don't get CRM accounts. They're just contacts/leads inside Green EnergiAi's CRM data.)

- Brand = `majix.ai`. Domain at IONOS, DNS on Cloudflare.
- Tenant gets: own user pool, own data, own theme (logo, colors, copy), own billing relationship with Majix.
- Routing: custom hostnames CNAME at `customers.majix.ai`. Cloudflare for SaaS catches them, proxies to this Worker. Worker reads `Host` header → org lookup via `get_org_by_domain` → renders white-labeled UI.

### Legacy "reseller" code in repo — don't strip in audits

Lovable scaffold included reseller-tier features that do not match the current business model: `is_reseller=true` org flag, `signup_under_reseller` SQL function, `reseller_payouts` + `reseller_plans` + `commission_rules` + `commission_earnings` tables, `r/$resellerSlug/signup.tsx` route, `BrandedSignup.tsx`. These represent a *possible future* sub-reseller model — not in use today.

**Custom-hostname + white-label features ARE still core** (they power the premium tier directly). Surfaces that stay first-class regardless of reseller framing: `CustomDomainsPanel`, `EditClientWhiteLabelDialog`, `DomainHealthPanel`, `src/functions/custom-hostnames.functions.ts`, `docs/custom-domains/cf-for-saas-setup.md`.

If an audit suggests killing "reseller-only" code, **don't unilaterally delete** — flag the candidate in `ISSUES.md` `## Open` under "Lovable cleanup follow-ups" for explicit review. Chesterton's fence.

### Hostname plan (live 2026-05-18 — all five tiers deployed + smoke-verified)

| Hostname | Role | Notes |
|---|---|---|
| `majix.ai` + `www.majix.ai` | Public marketing — landing, pricing, `/features`, `/contact`, signup CTA | Both serve the same Worker bundle. `www` does NOT 308 to apex — they're treated as peers. The marketing routes live alongside the CRM in `src/routes/*`; hostname does not change which route renders, only which UI surface the route returns. |
| `app.majix.ai` | Central CRM landing + Supabase Auth callbacks + Majix platform admin | All Supabase Auth redirect URLs land here. Tenants without a slug yet (or who came in via the `/r/<reseller>/signup` flow before pick) end up here. |
| `<slug>.majix.ai` | Per-tenant white-label CRM (free tier) | Wildcard Worker route + wildcard Advanced cert. Theme/brand resolved by `get_org_by_domain` path 2 (slug match). |
| `<custom>.acmecorp.com` | Per-tenant white-label CRM (premium tier) | Tenants CNAME their record to `customers.majix.ai`. CF for SaaS handles cert + routing. Theme resolved by `get_org_by_domain` path 1 (`org_custom_domains.hostname` match). |
| `customers.majix.ai` | CF for SaaS fallback — infrastructure only | Never user-visible. If hit directly, falls through to default Majix marketing — acceptable. |
| `notify.majix.ai` | Resend transactional email sender | SPF + DKIM verified. Outbound: `noreply@notify.majix.ai`. |

Routes are defined in `wrangler.jsonc`. The `*.majix.ai/*` wildcard does NOT match the apex (Cloudflare requires a non-empty label), so `majix.ai/*` needs its own explicit row. More-specific rows (`app`, `www`, `customers`) take precedence over the wildcard at the edge.

Reserved subdomain labels (never tenant slugs, blocked at both DB and client layers): `app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`. Enforced in:
- `get_org_by_domain` (migration `20260518020000_get_org_by_domain_majix_subdomain.sql`) — returns NULL early when the label is reserved
- `DomainBrandingProvider.SYSTEM_HOST_PATTERNS` — short-circuits the RPC call client-side

Tenant theming: `DomainBrandingProvider` reads `window.location.hostname`, skips the lookup for system hosts, otherwise calls `get_org_by_domain(host)`. The RPC has two paths: (1) verified custom hostname via `org_custom_domains` join, (2) slug match for `<label>.majix.ai`. Both return a `json` blob with `id`, `slug`, `brand_name`, `logo_url`, `favicon_url`, `font_family`, `primary_color`, `secondary_color`, `accent_color`, `sidebar_color`, `button_color`, `is_reseller`, `support_email`, `verified`. Majix subdomains always return `verified=true` (we own the parent zone + wildcard cert).

Reseller-named code (per "Legacy 'reseller' code" above) — don't unilaterally strip. White-label + custom-hostname features ARE the core premium product even though no resellers exist; the rest is dormant Lovable scaffold pending an explicit cleanup pass.

Prefer Supabase CLI (`supabase ...`) over MCP `mcp__plugin_supabase_supabase__*` tools — CLI authenticated via `SUPABASE_ACCESS_TOKEN` in `~/.zshrc`, costs no extra context tokens.

## Lookups: context7 first, training data never

Before writing or modifying any config, lockfile, plugin glue, or framework-specific code in this repo, hit **context7** (`mcp__context7__resolve-library-id` then `mcp__context7__query-docs`) for the relevant library. Don't trust training data on:

- `wrangler.jsonc` field shapes, `@cloudflare/vite-plugin` options (`viteEnvironment.name`, etc.)
- TanStack Start deployment targets (`main: "@tanstack/react-start/server-entry"` etc.)
- Bun lockfile format (`bun.lockb` binary vs `bun.lock` text — defaults shifted in 1.2)
- Supabase JS client config, Stripe API surface
- Any other lib/SDK touched in `package.json`

Burnt this lesson: pushed a `bun.lockb` binary lockfile to Cloudflare Workers Builds (running bun 1.2.15), which rejected it as "outdated lockfile version" under `--frozen-lockfile`. context7 would have flagged that `bun.lock` text format has been the default since bun 1.2 in two seconds. Don't repeat.

The global `~/.claude/rules/lookups.md` routing table is the source of truth for *which* tool to use for *which* class of lookup — this section just pins the rule into project context so non-Claude-Code agents see it too.

## Agent skills

Project-scoped agent skills live in `.agents/skills/` (universal, multi-agent) and `.claude/skills/` (Claude Code copies + symlinks). Pinned in `skills-lock.json`. Reproduce on a fresh clone:

```bash
npx -y skills@latest experimental_install
```

Bundled: TanStack Start/Router/Query/Integration, Stripe (best-practices, projects, upgrade), Resend (`resend`, `react-email`, `email-best-practices`), `web-design-guidelines`. Supabase, shadcn, and Vercel skills come from Claude Code **plugins** (auto-updated) — do NOT duplicate them via `skills add`.

## Dev server + env

Vite bakes `VITE_*` env vars into the dev bundle at startup. After ANY `.env` edit (especially `VITE_SUPABASE_URL`), kill the running `vite dev` and restart — HMR will not pick up env changes. Symptom of a stale-env bundle: login silently fails with "invalid credentials" because the bundle is still pointing at an abandoned Supabase project. Use `scripts/restart-dev.sh` — it kills stray vite processes, prints the resolved `VITE_SUPABASE_URL`, and starts a fresh `bun run dev`.
