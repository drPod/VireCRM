# genesisxsx

Multi-tenant white-label CRM SaaS. Customers sign up directly with Majix and get their own white-labeled CRM instance — on a `<slug>.majix.ai` subdomain (free tier, auto-provisioned at signup) or on their own custom hostname (premium tier, via Cloudflare for SaaS). No reseller layer; every tenant is a direct customer of Majix.

- Marketing site: https://majix.ai/
- Sign in / sign up: https://app.majix.ai/login
- Worker fallback (dev/preview): https://genesisxsx.darsh-pod.workers.dev/
- Vibe-coded original (Lovable): https://genesisx.space/ — trust nothing from it
- Repo: https://github.com/drPod/genesisxsx

**Working on this repo as an AI agent? Read [AGENTS.md](./AGENTS.md) first.** Claude Code: also reads [CLAUDE.md](./CLAUDE.md) automatically.

## Hostnames

The Worker answers on five hostname tiers. One bundle, behaviour switches on the `Host` header via `DomainBrandingProvider` + the `get_org_by_domain` Postgres function.

| Hostname | Audience | Surface |
|---|---|---|
| `majix.ai` + `www.majix.ai` | Public visitor | Marketing landing, pricing, signup CTA. Same routes as the rest of the app — the marketing pages live at `/`, `/pricing`, `/features`, `/contact`, etc. |
| `app.majix.ai` | Logged-in user without a tenant slug yet, plus the Majix platform operator | Central CRM landing. Auth callbacks (Supabase magic links + OAuth) land here too. Also where the Majix platform admin manages tenants (`/_app/admin`). |
| `<slug>.majix.ai` | Per-tenant white-label CRM (free tier) | Same CRM app, but theme + brand_name + favicon swapped to the tenant's settings. Every tenant is provisioned a slug at signup. Reserved labels (`app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`) are blocked at both the DB and client layers. |
| `<custom>.acmecorp.com` (any tenant-owned hostname) | Per-tenant white-label CRM (premium tier) | Same as the slug tier, but on a tenant-owned domain. Tenants CNAME their record to `customers.majix.ai`; Cloudflare for SaaS handles cert issuance + routing. Verification runbook: `docs/custom-domains/cf-for-saas-setup.md`. |
| `customers.majix.ai` | Infrastructure only — never user-visible | CF for SaaS fallback target. Custom hostnames CNAME here. |
| `notify.majix.ai` | Infrastructure only — Resend sender | Outbound transactional email comes from `noreply@notify.majix.ai`. |

Routes are defined in `wrangler.jsonc`. The `*.majix.ai/*` wildcard catches tenant slug subdomains; the explicit `app`/`www`/`customers` rows take precedence at the Cloudflare edge for those specific hostnames. The apex `majix.ai/*` needs its own row because the wildcard does not match an empty label.

The Cloudflare zone has a wildcard Advanced Certificate covering `majix.ai` + `*.majix.ai`. Universal SSL does not cover wildcards — keep the Advanced cert renewed.

## Stack

- TanStack Start (Vite + React 18, file-based router, server fns)
- Supabase (Postgres + Auth + Edge Functions, project `coynbufhejaeuifpvmvw`)
- Cloudflare Workers (deploy target via `@cloudflare/vite-plugin`)
- Cloudflare for SaaS (custom hostnames → `customers.majix.ai`)
- Stripe (billing), Resend (email, sender `notify.majix.ai`), Anthropic SDK (AI features)
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
- `routes` — hostname binding list. See "Hostnames" above for the five-tier plan. CF for SaaS runtime hostnames (the premium tier) are provisioned via the CF API at signup time, NOT listed in `routes` directly — only the `customers.majix.ai/*` fallback row covers them.
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
