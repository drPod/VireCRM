# genesisxsx

Multi-tenant white-label CRM SaaS. Customers sign up directly with VireCRM and get their own white-labeled CRM instance — on a `<slug>.virecrm.com` subdomain (free tier, auto-provisioned at signup) or on their own custom hostname (premium tier, via Cloudflare for SaaS). No reseller layer; every tenant is a direct customer of VireCRM.

The brand has been renamed from `Majix` / `majix.ai` to `VireCRM` / `virecrm.com`. The `majix.ai` hostnames now 308-redirect to their `virecrm.com` equivalents at the Worker layer — the cutover is complete.

- Marketing site: https://virecrm.com/
- Sign in / sign up: https://app.virecrm.com/login
- Worker fallback (dev/preview): https://genesisxsx.darsh-pod.workers.dev/
- Vibe-coded original (Lovable): https://genesisx.space/ — trust nothing from it
- Repo: https://github.com/drPod/genesisxsx

**Working on this repo as an AI agent? Read [AGENTS.md](./AGENTS.md) first.** Claude Code: also reads [CLAUDE.md](./CLAUDE.md) automatically.

## Hostnames

The Worker answers on five hostname tiers. One bundle, behaviour switches on the `Host` header via `DomainBrandingProvider` + the `get_org_by_domain` Postgres function.

Hostnames below are the canonical `virecrm.com` zone. The `majix.ai` zones 308-redirect to their `virecrm.com` equivalents at the Worker layer.

| Hostname | Audience | Surface |
|---|---|---|
| `virecrm.com` + `www.virecrm.com` | Public visitor | Marketing landing, pricing, signup CTA. Same routes as the rest of the app — the marketing pages live at `/`, `/pricing`, `/features`, `/contact`, etc. |
| `app.virecrm.com` | Logged-in user without a tenant slug yet, plus the VireCRM platform operator | Central CRM landing. Auth callbacks (Supabase magic links + OAuth) land here too. Also where the VireCRM platform admin manages tenants (`/_app/admin`). |
| `<slug>.virecrm.com` | Per-tenant white-label CRM (free tier) | Same CRM app, but theme + brand_name + favicon swapped to the tenant's settings. Every tenant is provisioned a slug at signup. Reserved labels (`app`, `www`, `customers`, `notify`, `api`, `admin`, `mail`) are blocked at both the DB and client layers. |
| `<custom>.acmecorp.com` (any tenant-owned hostname) | Per-tenant white-label CRM (premium tier) | Same as the slug tier, but on a tenant-owned domain. Tenants CNAME their record to `customers.virecrm.com`; Cloudflare for SaaS handles cert issuance + routing. Verification runbook: `docs/custom-domains/cf-for-saas-setup.md`. |
| `customers.virecrm.com` | Infrastructure only — never user-visible | CF for SaaS fallback target. Custom hostnames CNAME here. |
| `notify.virecrm.com` | Infrastructure only — Resend sender | DNS verified on Resend; all outbound transactional email comes from `noreply@notify.virecrm.com`. |

Routes are defined in `wrangler.jsonc`. The `*.virecrm.com/*` wildcard catches tenant slug subdomains; the explicit `app`/`www`/`customers` rows take precedence at the Cloudflare edge for those specific hostnames. The apex `virecrm.com/*` needs its own row because the wildcard does not match an empty label. The `majix.ai` routes in `wrangler.jsonc` serve 308 redirects to their `virecrm.com` equivalents.

The Cloudflare zone has a wildcard Advanced Certificate covering `virecrm.com` + `*.virecrm.com`. Universal SSL does not cover wildcards — keep the Advanced cert renewed.

## Stack

- TanStack Start (Vite + React 18, file-based router, server fns)
- Supabase (Postgres + Auth + Edge Functions, project `coynbufhejaeuifpvmvw`)
- Cloudflare Workers (deploy target via `@cloudflare/vite-plugin`)
- Cloudflare for SaaS (custom hostnames → `customers.virecrm.com`)
- Stripe (billing), Resend (email, sender `notify.virecrm.com`), Anthropic SDK (AI features)
- Bun 1.2+ (text `bun.lock`, NOT `bun.lockb`)
- shadcn/ui + Tailwind + Radix primitives

### Agent tooling (Cloudflare)

The `cloudflare@cloudflare` Claude Code plugin is installed in this repo's setup. AI agents working here should invoke the specific skill / MCP server for the task at hand instead of generic exploration or dashboard clicks. Routing table in [CLAUDE.md](./CLAUDE.md) "Cloudflare tooling" + [AGENTS.md](./AGENTS.md) "Cloudflare — which thing to invoke".

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
- Note: `CLOUDFLARE_LEGACY_ZONE_ID` is no longer needed — `majix.ai` routes serve 308 redirects, not dual-zone content.

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

## Temporary credentials

> Delete this section once Crystal signs in + rotates. Repo is private but credentials in tracked files are still bad hygiene — short-lived only.

- **Crystal Cameron** (`crystal@greenenergiai.com`, user `7ba2ebfa-f30e-449a-866e-085c5940c1d4`) — temp password `hSS1eLMQitFgJfdR` minted 2026-05-20. `must_change_password=true` flagged in `user_metadata`; client login flow should redirect to a password-reset screen on first sign-in.

## History

- Originally vibe-coded on Lovable. Codebase quality reflects that.
- Migrated off Vercel (couldn't execute the Lovable Vite preset's CF Worker bundle) → Cloudflare Workers Builds on 2026-05-17.
- Phase 1 of de-Lovable migration in progress: Anthropic SDK + Resend wired, Nango deferred.
- Hostname plan rolled out 2026-05-18: apex/www marketing, `app.virecrm.com` central CRM + auth, `<slug>.virecrm.com` per-tenant free white-label, custom hostnames via CF for SaaS. See migration `20260518020000_get_org_by_domain_majix_subdomain.sql` for the tenant-slug resolution logic.
- Brand rename 2026-05-19: `Majix` → `VireCRM`, `majix.ai` → `virecrm.com`. Cutover complete 2026-05-20 — `majix.ai` routes now 308-redirect to `virecrm.com` equivalents at the Worker. Resend sender domain `notify.virecrm.com` is verified and live.
