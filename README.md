# genesisxsx

Multi-tenant white-label CRM SaaS. Customers sign up directly with VireCRM and get their own white-labeled CRM instance — on a `<slug>.virecrm.com` subdomain (free tier, auto-provisioned at signup) or on their own custom hostname (premium tier, via Cloudflare for SaaS). No reseller layer; every tenant is a direct customer of VireCRM.

The brand is mid-rename from `Majix` / `majix.ai` to `VireCRM` / `virecrm.com`. Both zones serve in parallel during the cutover window; after roughly 90 days (~2026-08-17) the legacy `majix.ai` hostnames will 308 to their `virecrm.com` equivalents. Until then, both work — don't strip references to `majix.ai` in this repo without checking the parallel-cutover context first.

- Marketing site: https://virecrm.com/ (legacy still live: https://majix.ai/)
- Sign in / sign up: https://app.virecrm.com/login (legacy still live: https://app.majix.ai/login)
- Worker fallback (dev/preview): https://genesisxsx.darsh-pod.workers.dev/
- Vibe-coded original (Lovable): https://genesisx.space/ — trust nothing from it
- Repo: https://github.com/drPod/genesisxsx

**Working on this repo as an AI agent? Read [AGENTS.md](./AGENTS.md) first.** Claude Code: also reads [CLAUDE.md](./CLAUDE.md) automatically.

## Hostnames

The Worker answers on five hostname tiers. One bundle, behaviour switches on the `Host` header via `DomainBrandingProvider` + the `get_org_by_domain` Postgres function.

Hostnames below are listed as the new canonical `virecrm.com` zone. During the parallel-cutover window the matching `majix.ai` zones (`majix.ai`, `www.majix.ai`, `app.majix.ai`, `<slug>.majix.ai`, `customers.majix.ai`, `notify.majix.ai`) continue resolving against the same Worker bundle via additive routes in `wrangler.jsonc`. After ~2026-08-17 the legacy zones flip to 308 redirects toward the `virecrm.com` equivalents.

| Hostname | Audience | Surface |
|---|---|---|
| `virecrm.com` + `www.virecrm.com` | Public visitor | Marketing landing, pricing, signup CTA. Same routes as the rest of the app — the marketing pages live at `/`, `/pricing`, `/features`, `/contact`, etc. |
| `app.virecrm.com` | Logged-in user without a tenant slug yet, plus the VireCRM platform operator | Central CRM landing. Auth callbacks (Supabase magic links + OAuth) land here too. Also where the VireCRM platform admin manages tenants (`/_app/admin`). |
| `<slug>.virecrm.com` | Per-tenant white-label CRM (free tier) | Same CRM app, but theme + brand_name + favicon swapped to the tenant's settings. Every tenant is provisioned a slug at signup. Reserved labels (`app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`) are blocked at both the DB and client layers. |
| `<custom>.acmecorp.com` (any tenant-owned hostname) | Per-tenant white-label CRM (premium tier) | Same as the slug tier, but on a tenant-owned domain. Tenants CNAME their record to `customers.virecrm.com`; Cloudflare for SaaS handles cert issuance + routing. Verification runbook: `docs/custom-domains/cf-for-saas-setup.md`. |
| `customers.virecrm.com` | Infrastructure only — never user-visible | CF for SaaS fallback target. Custom hostnames CNAME here. |
| `notify.virecrm.com` | Infrastructure only — Resend sender (pending) | Pending Resend DNS verification (user owes ~24h external action). `notify.majix.ai` is still the active verified sender during cutover — outbound transactional email currently comes from `noreply@notify.majix.ai`. |

Routes are defined in `wrangler.jsonc`. The `*.virecrm.com/*` wildcard catches tenant slug subdomains; the explicit `app`/`www`/`customers` rows take precedence at the Cloudflare edge for those specific hostnames. The apex `virecrm.com/*` needs its own row because the wildcard does not match an empty label. The legacy `*.majix.ai/*` plus the apex + sub-rows remain in `wrangler.jsonc` in parallel until the 308 cutover.

The Cloudflare zone has a wildcard Advanced Certificate covering `virecrm.com` + `*.virecrm.com` (and the legacy `majix.ai` + `*.majix.ai` cert while the parallel cutover is live). Universal SSL does not cover wildcards — keep the Advanced cert renewed on both zones until the legacy zone is retired.

## Stack

- TanStack Start (Vite + React 18, file-based router, server fns)
- Supabase (Postgres + Auth + Edge Functions, project `coynbufhejaeuifpvmvw`)
- Cloudflare Workers (deploy target via `@cloudflare/vite-plugin`)
- Cloudflare for SaaS (custom hostnames → `customers.virecrm.com`; legacy `customers.majix.ai` still resolving during parallel cutover)
- Stripe (billing), Resend (email, sender `notify.majix.ai` today; `notify.virecrm.com` pending DNS verification), Anthropic SDK (AI features)
- Bun 1.2+ (text `bun.lock`, NOT `bun.lockb`)
- shadcn/ui + Tailwind + Radix primitives

## Quick start

```bash
bun install
cp .env.development .env       # fill VITE_SUPABASE_* if not present
bash scripts/install-hooks.sh  # one-time: activate .githooks/ (ISSUES.md lint on commit)
bun run dev                    # vite dev on :8080
```

Vite bakes `VITE_*` into bundle at startup. Edit `.env` → restart dev server (HMR will not pick up env). Use `scripts/restart-dev.sh`.

## Commands

| Command | Use |
|---|---|
| `bun run dev` | Vite dev server |
| `bun run build` | Production bundle (Worker entry: `src/server.ts`) |
| `bun run preview` | Local preview of built bundle |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run typecheck:fresh` | Nuke caches first, then typecheck |
| `bun run lint` | ESLint |
| `bun run format` | Prettier write |
| `bun run test` | Vitest run |
| `bun run test:e2e` | Playwright e2e |
| `bun run test:visual` | Playwright visual regression |
| `bun run clean` | Wipe `.vite`, `.tanstack`, `dist`, `routeTree.gen.ts` |

## Deploy

Cloudflare Workers Builds on push to `main`. Builder runs Bun 1.2.15 with `--frozen-lockfile`. **Never commit `bun.lockb` (binary)** — CF rejects it. Bun 1.2+ default = `bun.lock` (text). Manual deploy: `bun run build && bunx wrangler deploy`.

`wrangler.jsonc` keys you'll touch:
- `vars` — non-secret public env (Supabase URL + publishable key)
- `routes` — hostname binding list. See "Hostnames" above for the five-tier plan. CF for SaaS runtime hostnames (the premium tier) are provisioned via the CF API at signup time, NOT listed in `routes` directly — only the `customers.virecrm.com/*` fallback row covers them (with the legacy `customers.majix.ai/*` row still present in parallel).
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`) → `wrangler secret put <NAME>`

If you add a new route, redeploy with `bun run build && bunx wrangler deploy --config dist/server/wrangler.json`. The `@cloudflare/vite-plugin` bakes the source `wrangler.jsonc` into `dist/server/wrangler.json` at build time — that's the file the deploy reads.

## Layout

```
src/
  routes/         file-based routes (TanStack Router)
  components/     UI (shadcn-based)
  functions/      server fns (custom-hostnames, etc.)
  integrations/   supabase, stripe, resend, anthropic clients
  lib/            shared utilities
  server.ts       Worker entry
supabase/
  migrations/     SQL migrations
  functions/      edge functions
docs/
  custom-domains/ CF for SaaS runbook + DNS notes
  handoffs/       phase plans, migration logs
  superpowers/    vendored skill docs
```

## Key docs

- [AGENTS.md](./AGENTS.md) — agent-facing routing index (tool-agnostic)
- [CLAUDE.md](./CLAUDE.md) — Claude Code project conventions + gotchas
- [ISSUES.md](./ISSUES.md) — running log of bugs found + fixes (append findings)
- [docs/custom-domains/cf-for-saas-setup.md](./docs/custom-domains/cf-for-saas-setup.md) — premium-tier custom hostname runbook
- [docs/handoffs/](./docs/handoffs/) — phase plans + migration logs
- [docs/UI_QA_CHECKLIST.md](./docs/UI_QA_CHECKLIST.md) — manual QA checklist

## History

- Originally vibe-coded on Lovable. Codebase quality reflects that.
- Migrated off Vercel (couldn't execute the Lovable Vite preset's CF Worker bundle) → Cloudflare Workers Builds on 2026-05-17.
- Phase 1 of de-Lovable migration in progress: Anthropic SDK + Resend wired, Nango deferred.
- Hostname plan rolled out 2026-05-18: apex/www marketing, `app.majix.ai` central CRM + auth, `*.majix.ai` per-tenant free white-label, custom hostnames via CF for SaaS. See migration `20260518020000_get_org_by_domain_majix_subdomain.sql` for the tenant-slug resolution logic.
- Brand rename 2026-05-19: `Majix` → `VireCRM`, `majix.ai` → `virecrm.com`. Parallel-cutover plan — both zones serve the same Worker bundle through ~2026-08-17, after which the legacy `majix.ai` zones 308 to their `virecrm.com` equivalents. Resend sender domain `notify.virecrm.com` is pending DNS verification; `notify.majix.ai` stays the active sender until that lands.
