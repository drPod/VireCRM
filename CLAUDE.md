# genesisxsx

Vibe-coded on Lovable — trust no existing code, we're here to fix it. Log every finding to `ISSUES.md`.

- Vibe-coded original: https://genesisx.space/
- Fixed version (this repo, deployed to Cloudflare Workers): https://genesisxsx.darsh-pod.workers.dev

Host migration history: Vercel was abandoned because the Lovable Vite preset emits a Cloudflare Worker bundle that Vercel can't execute. See ISSUES.md 2026-05-17 Cloudflare migration.

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
