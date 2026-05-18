# genesisxsx

Claude Code conventions + gotchas. Auto-loaded into Claude Code context every session.

**Companions (keep in sync when editing):**
- `README.md` — human entry: setup, commands, deploy, layout
- `AGENTS.md` — tool-agnostic mirror of invariants below (for Cursor / Aider / Codex / Copilot; they don't auto-load this file)
- `ISSUES.md` — living build log; **read `## Open` first, append findings to `## Recent` before claiming done.** Full protocol in `ISSUES.md` "How to append" section.

If you change a core invariant in this file (reseller-features-first-class, context7-first, Supabase-CLI > MCP, vite env-bake, bun.lock text, ISSUES.md protocol), mirror the change in `AGENTS.md` so non-Claude agents stay aligned. Surface area is small — drift = different agents acting on different rules.

## ISSUES.md is non-negotiable

Every session, before any other work: read `ISSUES.md` `## Open`. It contains: secrets/DNS the user owes, Phase 2 Lovable-cleanup follow-ups, bugs found-not-fixed (file:line), verification debts, product-call out-of-scope items. Transient categories (push-pending, in-flight audits) appear/vanish as work lands — read the live file.

Every finding (bug discovered, audit result, schema gap) and every fix (commit landed, cron applied, route wired): append a section under `## Recent` using the template in `ISSUES.md` "How to append". Strike-through resolved items in `## Recent`; delete from `## Open`.

Cold sections (fully resolved AND >14 days old) move to `docs/issues-archive/YYYY-MM.md` (append verbatim, newest on top, tagged inline). Update `docs/issues-archive/README.md` table when creating a new month file. Don't let `ISSUES.md` grow past ~500 lines — archive aggressively.

Archive is queryable corpus: `grep -nE '\[cf-saas\]' docs/issues-archive/*.md` etc. Tag glossary + conventions in `docs/issues-archive/README.md`. Use it before re-investigating something the team already shipped — saves spinning up audits twice.

Vibe-coded on Lovable — trust no existing code, we're here to fix it.

- Vibe-coded original: https://genesisx.space/
- Fixed version (this repo, deployed to Cloudflare Workers): https://genesisxsx.darsh-pod.workers.dev

Host migration history: Vercel was abandoned because the Lovable Vite preset emits a Cloudflare Worker bundle that Vercel can't execute. See ISSUES.md 2026-05-17 Cloudflare migration.

## What this product is (business model)

**CRM-as-a-Service. Client is reseller. Her customers get white-labeled CRM instances on their own hostnames.** Not a single-tenant CRM, not a SaaS for one company.

- Client = the reseller. Brand = `majix.ai`. Domain registered at IONOS, DNS now on Cloudflare.
- Her customers = "resold orgs" inside the multi-tenant CRM. Each gets:
  - Own custom hostname (e.g. `crm.acmecorp.com`) OR a Majix-branded subdomain
  - White-label theme (logo, colors, copy)
  - Own user pool, own data, own billing relationship with the reseller
- Routing: customer hostnames CNAME at `customers.majix.ai`. Cloudflare for SaaS catches them, proxies to this Worker. Worker reads `Host` header → org lookup → renders white-labeled UI.
- Feature surfaces: `is_reseller=true` org flag, `CustomDomainsPanel`, `EditClientWhiteLabelDialog`, `DomainHealthPanel`, `src/functions/custom-hostnames.functions.ts`, `docs/custom-domains/cf-for-saas-setup.md`. These are **first-class product features**, not Lovable dead code — do not strip when seen in audits.

### Hostname plan (designed 2026-05-18; routes bound in `wrangler.jsonc`, DNS pending)

| Hostname | Role | State |
|---|---|---|
| `majix.ai` + `www.majix.ai` | Public marketing — landing, pricing, signup CTA | Worker route bound; CF DNS still needs apex `A` + `www` `CNAME` proxied |
| `app.majix.ai` | Central CRM landing + auth callbacks + Majix platform admin (operator surface) | Worker route bound; CF DNS still needs `CNAME` proxied |
| `<slug>.majix.ai` | Per-tenant white-label CRM (free tier — every tenant gets one at signup) | Wildcard Worker route bound; CF DNS needs wildcard `A` for `*` proxied + wildcard cert on the zone |
| `<custom>.acmecorp.com` | Per-tenant white-label CRM (premium tier — custom hostname via CF for SaaS) | Tenants `CNAME` to `customers.majix.ai`; existing CF for SaaS flow handles cert + routing |
| `customers.majix.ai` | CF for SaaS fallback — infra only, never user-visible | Live |
| `notify.majix.ai` | Resend sender subdomain (transactional email) | Live, verified |

Reserved subdomain labels (never assigned as tenant slugs, hard-coded in `get_org_by_domain` + `DomainBrandingProvider` `SYSTEM_HOST_PATTERNS`): `app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`.

Tenant theming: `DomainBrandingProvider` calls `get_org_by_domain(hostname)` which resolves both custom hostnames (path 1, `organizations.custom_domain` match) AND `<slug>.majix.ai` subdomains (path 2, slug match). Reserved labels short-circuit to NULL on the server side too.

If a feature looks like it only matters for resellers and the audit suggests killing it: **keep it.** Reseller path is core, not optional.

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
