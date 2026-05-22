# @cloudflare/vite-plugin (Workers + Vite 5/6 integration)

**Snapshot:** 2026-05-22 (see `_snapshot_date.txt`)
**Origin:** https://developers.cloudflare.com/workers/vite-plugin
**Refresh:** `bash scripts/sync-cloudflare-vite-plugin-docs.sh` from repo root.

Local mirror of the official Cloudflare docs for `@cloudflare/vite-plugin`, the
plugin we use to integrate Vite with the Workers runtime (`workerd`) for
`<tenant>.virecrm.com`. Read these before reaching for WebFetch / context7 on
plugin questions.

## When to consult

Agent debugging a Vite + Workers issue or scaffolding a new piece of the SPA →
start here, not at the live docs site. Versions drift on the live site; this
mirror is pinned.

Triggers:

- "Why does `vite dev` see/not-see a binding?" → `reference-api.md` +
  `reference-cloudflare-environments.md`.
- Static asset routing, SPA fallback, headers/redirects → `reference-static-assets.md`.
- Adding/touching `wrangler.jsonc` `compatibility_date` / `compatibility_flags`
  (incl. `nodejs_compat`) → `get-started.md` + `reference-api.md`.
- Setting up CI/preview/build pipelines → `get-started.md` + `tutorial.md`.
- Debugging dev-server crashes, source maps, breakpoints →
  `reference-debugging.md`.
- Migrating off `wrangler dev` → `reference-migrating-from-wrangler-dev.md`.
- Programmatic / per-env plugin config →
  `reference-programmatic-configuration.md`.
- Secret injection in dev → `reference-secrets.md`.
- Wasm / text / binary imports → `reference-non-javascript-modules.md`.

## Key API symbols

- `cloudflare()` — default plugin export. Accepts `PluginConfig`.
- `interface PluginConfig` — top-level options:
  `configPath`, `viteEnvironment`, `persistState`, `auxiliaryWorkers`,
  `inspectorPort`, `experimental`.
- `interface AuxiliaryWorkerConfig` — sidecar Worker config for multi-Worker
  apps.
- `compatibility_date` / `compatibility_flags` — set in `wrangler.jsonc`, not
  in the plugin. `nodejs_compat` flag = `node:*` builtins.
- Static assets: `assets.directory`, `assets.binding`,
  `assets.not_found_handling`, `_headers`, `_redirects` (see
  `reference-static-assets.md`).
- Cloudflare environments: top-level vs `[env.<name>]` in `wrangler.jsonc`;
  `CLOUDFLARE_ENV` selects at dev time.

## Files (size · what's in it)

| File | Bytes | Consult when |
|------|-------|--------------|
| `index.md` | 3.0K | Landing page. Use-cases overview. Read once. |
| `get-started.md` | 4.2K | Scratch project setup: `package.json` → `vite.config.ts` → `wrangler.jsonc` → entry. Cmds: `dev` / `build` / `preview` / `deploy`. |
| `tutorial.md` | 13K | End-to-end: React SPA + API Worker. Most concrete example we have. |
| `reference-api.md` | 7.5K | **`cloudflare()`, `PluginConfig`, `AuxiliaryWorkerConfig`.** Read first for any plugin-options question. |
| `reference-static-assets.md` | 4.6K | `assets.*` config, SPA fallback (`not_found_handling`), `_headers` + `_redirects` semantics. |
| `reference-cloudflare-environments.md` | 9.0K | `[env.<name>]` blocks, `CLOUDFLARE_ENV`, Vite-mode vs CF-env split, secrets in local dev. |
| `reference-vite-environments.md` | 4.6K | Vite Environment API (separate concept from CF envs). Maps Worker code into Vite's SSR-style environment. |
| `reference-debugging.md` | 3.3K | Inspector port, source maps, breakpoints in Chrome/VSCode. |
| `reference-migrating-from-wrangler-dev.md` | 4.6K | Cheat sheet for moving off `wrangler dev` to `vite dev`. |
| `reference-non-javascript-modules.md` | 2.1K | Wasm, text, binary imports — what builds, what doesn't. |
| `reference-programmatic-configuration.md` | 7.1K | Calling `cloudflare()` with computed config; using Vite's `defineConfig` w/ env. |
| `reference-secrets.md` | 1.8K | `.dev.vars`, secret precedence in local dev, NOT for prod (use `wrangler secret put`). |
| `llms-vite-plugin.md` | 68K | All 12 pages concatenated, as sliced from `https://developers.cloudflare.com/llms-full.txt`. Use for grep-able full-text search across the whole subtree. |
| `_urls.txt` | — | Every URL the sync script pulled on the last run. |
| `_snapshot_date.txt` | — | UTC date of the last successful sync. |

## Project conventions

Stack invariants live in `CLAUDE.md` at the repo root. The relevant ones for
this plugin:

- React Router v7 framework mode + `@cloudflare/vite-plugin` GA.
- CF Workers deploy with `nodejs_compat` ON.
- Internal `/api/*` via Hono inside the Worker is acceptable.

Do not re-litigate the framework-mode decision via these docs; it's a `docs/decisions/`
call.
