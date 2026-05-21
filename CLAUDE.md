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

### `og_database/` — legacy Lovable Supabase dumps (gitignored)

OLD Lovable Supabase project dump, captured 2026-05-19. Four files: `genesis_auth_data.sql` (47k, 23 auth.users w/ bcrypt + PII), `genesis_database_schema.sql` (382k), `genesis_database_full.sql` (3.4M), `genesis_database_full_with_auth.sql` (3.4M). Folder gitignored — **never commit**.

**Migration ran 2026-05-19, verified live 2026-05-22.** Data ported to current `coynbufhejaeuifpvmvw` project: auth.users w/ preserved UUIDs + bcrypt passwords, two tenants split cleanly (Crystal owns `188c4869-…` slug `greenenergiai`, Caziah owns separate tenant `8b8c76ab-…` slug `caziah-cameron`), ~14k leads total w/ xlsx-enriched energy fields on Caziah's broker book. Dumps stay around until Step 6 of `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md` freezes the old Lovable project + archives them.

**Reading from it is fine** (audit, reconciliation, post-port verification) — `grep`, `head`, `wc -l` ok. **Don't `cat` the full file into context** — auth dump is 47k of bcrypt hashes, full dumps 3.4M each. Use targeted `grep` or `sed` line ranges.

Migration log: `docs/handoffs/2026-05-19-lovable-to-fixed-db-migration.md`. Recent verification record: `ISSUES.md ## Recent` 2026-05-22 entry.

## What this product is (business model)

**Multi-tenant CRM SaaS.** Customers sign up directly with VireCRM. Each customer = one tenant org. Every tenant gets a white-labeled CRM instance:

- **Free tier:** auto-provisioned `<slug>.virecrm.com` subdomain (every tenant at signup).
- **Premium tier:** own custom hostname (e.g. `crm.acmecorp.com`) via Cloudflare for SaaS.

**No reseller layer.** Nobody resells the CRM. Every row in `organizations` = direct end-tenant of VireCRM. (Examples: Green EnergiAi is a tenant — they sell energy contracts to their own customers, but those customers don't get CRM accounts. They're just contacts/leads inside Green EnergiAi's CRM data.)

- Brand = `virecrm.com`. `majix.ai` 308-redirects at Worker layer — retired. Domain at IONOS, DNS on Cloudflare.
- Tenant gets: own user pool, own data, own theme (logo, colors, copy), own billing relationship with VireCRM.
- Routing: custom hostnames CNAME at `customers.virecrm.com`. Cloudflare for SaaS catches them, proxies to this Worker. Worker reads `Host` header → org lookup via `get_org_by_domain` → renders white-labeled UI.

### Lovable scaffold cleanup — delete confidently when dead

Lovable seeded reseller-tier scaffold not used by current business model: `is_reseller=true` org flag, `signup_under_reseller` SQL fn, `reseller_payouts` + `reseller_plans` + `commission_rules` + `commission_earnings` tables, `r/$resellerSlug/signup.tsx` route, `BrandedSignup.tsx`. Same situation for the "verticals" abstraction (Energy Hub / LOAs / Usage / Pricing / Contracts / Suppliers / Renewals / Solar Hub / Solar Projects) — Lovable's multi-industry placeholder, gated behind padlocks the only live client can't unlock.

Audit confirms dead → delete. No "flag for review" gate. Note the removal in `ISSUES.md` `## Recent` with file list + commit sha so future audits can grep history.

**Keep** (still core to premium tier, NOT scaffold): `CustomDomainsPanel`, `EditClientWhiteLabelDialog`, `DomainHealthPanel`, `src/functions/custom-hostnames.functions.ts`, `docs/custom-domains/cf-for-saas-setup.md`. Custom-hostname + white-label power the premium tier even with no resellers.

### Hostname plan (live 2026-05-20 — virecrm.com canonical, majix.ai 308-redirects at Worker)

| Hostname | Role | Notes |
|---|---|---|
| `virecrm.com` + `www.virecrm.com` | Public marketing — landing, pricing, `/features`, `/contact`, signup CTA | Both serve the same Worker bundle. `www` does NOT 308 to apex — treated as peers. Marketing routes live alongside CRM in `src/routes/*`; hostname does not change which route renders, only which UI surface route returns. |
| `app.virecrm.com` | Central CRM landing + Supabase Auth callbacks + VireCRM platform admin | All Supabase Auth redirect URLs land here. Tenants without slug yet (or came in via `/r/<reseller>/signup` flow before pick) end up here. |
| `<slug>.virecrm.com` | Per-tenant white-label CRM (free tier) | Wildcard Worker route + wildcard Advanced cert. Theme/brand resolved by `get_org_by_domain` path 2 (slug match). |
| `<custom>.acmecorp.com` | Per-tenant white-label CRM (premium tier) | Tenants CNAME their record to `customers.virecrm.com`. CF for SaaS handles cert + routing. Theme resolved by `get_org_by_domain` path 1 (`org_custom_domains.hostname` match). |
| `customers.virecrm.com` | CF for SaaS fallback — infrastructure only | Never user-visible. If hit directly, falls through to default VireCRM marketing — acceptable. |
| `notify.virecrm.com` | Resend transactional email sender (live 2026-05-20) | DNS verified on Resend; test send delivered. All `SENDER_DOMAIN` + `FROM_DOMAIN` constants in code point here. |

Routes defined in `wrangler.jsonc`. `*.virecrm.com/*` wildcard does NOT match apex (Cloudflare requires non-empty label), so `virecrm.com/*` needs own explicit row. More-specific rows (`app`, `www`, `customers`) take precedence over wildcard at edge. `majix.ai` routes serve 308 redirects to `virecrm.com` equivalents.

Reserved subdomain labels (never tenant slugs, blocked at both DB + client layers): `app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`. Enforced in:
- `get_org_by_domain` (migration `20260518020000_get_org_by_domain_majix_subdomain.sql`) — returns NULL early when label is reserved
- `DomainBrandingProvider.SYSTEM_HOST_PATTERNS` — short-circuits RPC call client-side

Tenant theming: `DomainBrandingProvider` reads `window.location.hostname`, skips lookup for system hosts, otherwise calls `get_org_by_domain(host)`. RPC has two paths: (1) verified custom hostname via `org_custom_domains` join, (2) slug match for `<label>.virecrm.com`. Both return `json` blob with `id`, `slug`, `brand_name`, `logo_url`, `favicon_url`, `font_family`, `primary_color`, `secondary_color`, `accent_color`, `sidebar_color`, `button_color`, `is_reseller`, `support_email`, `verified`. VireCRM subdomains always return `verified=true` (own parent zone + wildcard cert).

White-label + custom-hostname features ARE core premium product even though no resellers exist. Rest of reseller-named scaffold = delete per "Lovable scaffold cleanup" rule above.

Prefer Supabase CLI (`supabase ...`) over MCP `mcp__plugin_supabase_supabase__*` tools — CLI authenticated via `SUPABASE_ACCESS_TOKEN` in `~/.zshrc`, costs no extra context tokens.

## Lookups: context7 first, training data never

Before writing or modifying any config, lockfile, plugin glue, or framework-specific code in this repo, hit **context7** (`mcp__context7__resolve-library-id` then `mcp__context7__query-docs`) for the relevant library. Don't trust training data on:

- `wrangler.jsonc` field shapes, `@cloudflare/vite-plugin` options (`viteEnvironment.name`, etc.)
- TanStack Start deployment targets (`main: "@tanstack/react-start/server-entry"` etc.)
- Bun lockfile format (`bun.lockb` binary vs `bun.lock` text — defaults shifted in 1.2)
- Supabase JS client config, Stripe API surface
- Any other lib/SDK touched in `package.json`

Burnt this lesson: pushed a `bun.lockb` binary lockfile to Cloudflare Workers Builds (running bun 1.2.15), which rejected it as "outdated lockfile version" under `--frozen-lockfile`. context7 would have flagged that `bun.lock` text format has been the default since bun 1.2 in two seconds. Don't repeat.

**Cloudflare-specific carve-out.** For CF platform / Workers questions, invoke the `cloudflare:cloudflare` skill (Skill tool) instead of context7. Skill is vendor-authoritative + bundles current API surface. context7 still wins for everything else (TanStack, Supabase JS, Stripe, Resend, Anthropic SDK, etc.).

The global `~/.claude/rules/lookups.md` routing table is the source of truth for *which* tool to use for *which* class of lookup — this section just pins the rule into project context so non-Claude-Code agents see it too.

## Cloudflare tooling — which thing to invoke for which task

`cloudflare@cloudflare` plugin is installed. Don't re-install. Don't dashboard-click work the tools already cover. Use this routing table:

| Task | Invoke |
|---|---|
| DNS records on `virecrm.com` / `majix.ai` zones | `mcp__plugin_cloudflare_cloudflare-api__*` |
| CF for SaaS custom-hostname provision / verify / list | `mcp__plugin_cloudflare_cloudflare-api__*` |
| Zone settings, rules engine, Page Rules, certs, Advanced cert order | `mcp__plugin_cloudflare_cloudflare-api__*` |
| Wrangler CLI (deploy, `secret put`, `tail`, `dev`, `kv:*`, etc.) | `cloudflare:wrangler` skill, then shell out `wrangler ...` |
| Author / review `src/server.ts` or `src/functions/*.functions.ts` | `cloudflare:workers-best-practices` skill |
| Worker logs + metrics during smoke (filtered, historical) | `mcp__plugin_cloudflare_cloudflare-observability__*` |
| Workers Builds CI status / build logs after push to `main` | `mcp__plugin_cloudflare_cloudflare-builds__*` |
| Web Vitals / perf regression diagnosis | `cloudflare:web-perf` skill |
| General CF platform / API surface lookups | `cloudflare:cloudflare` skill |

CF API + observability + builds MCP servers require one-time `authenticate` (OAuth, opens browser). Re-auth persists across sessions.

Skipped (loaded but not used in this repo): `cloudflare-bindings` MCP (no KV / D1 / R2 / Vectorize / Durable Objects — only Worker routes + secrets), `cloudflare:agents-sdk`, `cloudflare:sandbox-sdk`, `cloudflare:durable-objects`, `cloudflare:cloudflare-email-service` (Resend, not CF Email), `cloudflare:build-mcp`, `cloudflare:build-agent`.

## Agent skills

Project-scoped agent skills live in `.agents/skills/` (universal, multi-agent) and `.claude/skills/` (Claude Code copies + symlinks). Pinned in `skills-lock.json`. Reproduce on a fresh clone:

```bash
npx -y skills@latest experimental_install
```

Bundled: TanStack Start/Router/Query/Integration, Stripe (best-practices, projects, upgrade), Resend (`resend`, `react-email`, `email-best-practices`), `web-design-guidelines`. Supabase, shadcn, Vercel, and **Cloudflare** skills come from Claude Code **plugins** (auto-updated) — do NOT duplicate them via `skills add`.

## Dev server + env

Vite bakes `VITE_*` env vars into the dev bundle at startup. After ANY `.env` edit (especially `VITE_SUPABASE_URL`), kill the running `vite dev` and restart — HMR will not pick up env changes. Symptom of a stale-env bundle: login silently fails with "invalid credentials" because the bundle is still pointing at an abandoned Supabase project. Use `scripts/restart-dev.sh` — it kills stray vite processes, prints the resolved `VITE_SUPABASE_URL`, and starts a fresh `bun run dev`.
