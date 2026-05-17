# genesisxsx

Vibe-coded on Lovable — trust no existing code, we're here to fix it. Log every finding to `ISSUES.md`.

- Vibe-coded original: https://genesisx.space/
- Fixed version (this repo, deployed to Cloudflare Workers): https://genesisxsx.darsh-pod.workers.dev

Host migration history: Vercel was abandoned because the Lovable Vite preset emits a Cloudflare Worker bundle that Vercel can't execute. See ISSUES.md 2026-05-17 Cloudflare migration.

Prefer Supabase CLI (`supabase ...`) over MCP `mcp__plugin_supabase_supabase__*` tools — CLI authenticated via `SUPABASE_ACCESS_TOKEN` in `~/.zshrc`, costs no extra context tokens.

## Agent skills

Project-scoped agent skills live in `.agents/skills/` (universal, multi-agent) and `.claude/skills/` (Claude Code copies + symlinks). Pinned in `skills-lock.json`. Reproduce on a fresh clone:

```bash
npx -y skills@latest experimental_install
```

Bundled: TanStack Start/Router/Query/Integration, Stripe (best-practices, projects, upgrade), `web-design-guidelines`. Supabase, shadcn, and Vercel skills come from Claude Code **plugins** (auto-updated) — do NOT duplicate them via `skills add`.

## Dev server + env

Vite bakes `VITE_*` env vars into the dev bundle at startup. After ANY `.env` edit (especially `VITE_SUPABASE_URL`), kill the running `vite dev` and restart — HMR will not pick up env changes. Symptom of a stale-env bundle: login silently fails with "invalid credentials" because the bundle is still pointing at an abandoned Supabase project. Use `scripts/restart-dev.sh` — it kills stray vite processes, prints the resolved `VITE_SUPABASE_URL`, and starts a fresh `bun run dev`.
