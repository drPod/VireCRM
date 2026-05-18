# genesisxsx

White-label CRM-as-a-Service. Reseller (`majix.ai`) sells branded CRM instances to her customers. Each customer = "resold org" with own hostname, theme, user pool, data.

- Live: https://genesisxsx.darsh-pod.workers.dev
- Vibe-coded original (Lovable): https://genesisx.space/ — trust nothing from it
- Repo: https://github.com/drPod/genesisxsx

**Working on this repo as an AI agent? Read [AGENTS.md](./AGENTS.md) first.** Claude Code: also reads [CLAUDE.md](./CLAUDE.md) automatically.

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
cp .env.development .env  # fill VITE_SUPABASE_* if not present
bun run dev               # vite dev on :8080
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
- `routes` — Cloudflare for SaaS reseller hostnames pattern
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`) → `wrangler secret put <NAME>`

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
- [docs/custom-domains/cf-for-saas-setup.md](./docs/custom-domains/cf-for-saas-setup.md) — reseller hostname runbook
- [docs/handoffs/](./docs/handoffs/) — phase plans + migration logs
- [docs/UI_QA_CHECKLIST.md](./docs/UI_QA_CHECKLIST.md) — manual QA checklist

## History

- Originally vibe-coded on Lovable. Codebase quality reflects that.
- Migrated off Vercel (couldn't execute the Lovable Vite preset's CF Worker bundle) → Cloudflare Workers Builds on 2026-05-17.
- Phase 1 of de-Lovable migration in progress: Anthropic SDK + Resend wired, Nango deferred.
