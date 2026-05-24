# Sentry (CF Worker + React Router v7 + Vite sourcemaps)

**Snapshot:** 2026-05-24
**Source:** `https://docs.sentry.io` (Mintlify; markdown via URL `.md` suffix)
**Refresh:** `bash scripts/sync-sentry-docs.sh`
**Scope:** CF Worker init (`@sentry/cloudflare`) + RR7 framework-mode client/server (`@sentry/react-router`) + Vite sourcemap upload (`@sentry/vite-plugin`) + DSN concept.

Read order, fresh wire-up: `dsn-explainer.md` → `cloudflare.md` → `react-router-manual-setup.md` → `sourcemaps-vite.md` → `cloudflare-releases.md`. Troubleshoot bad/missing source maps in browser: `sourcemaps-troubleshooting.md`.

## Files

| File | Size | When to consult | Key symbols |
|------|------|-----------------|-------------|
| `cloudflare.md` | 21K | Wiring `@sentry/cloudflare` in the Worker. Workers vs Pages, `nodejs_compat` requirement, `withSentry` wrap, `wrapRequestHandler` for non-default entry. | `Sentry.withSentry`, `Sentry.wrapRequestHandler`, `Sentry.captureException`, `compatibility_flags = ["nodejs_compat"]`, `SENTRY_RELEASE` env |
| `cloudflare-frameworks.md` | 3.5K | Pick the right Sentry guide when the Worker fronts a framework SSR (Astro / Remix / Hydrogen / Next / Nuxt / SvelteKit / TanStack Start). RR7 = use `react-router*.md` not this. | Framework-guide redirect index |
| `cloudflare-releases.md` | 4.9K | Tagging events with a release version for source-map symbolication + regression detection. Vite-plugin auto-sets `SENTRY_RELEASE`; manual override path. | `Sentry.init({ release })`, `SENTRY_RELEASE`, `process.env.SENTRY_RELEASE` |
| `react-router.md` | 19K | Quickstart for RR7 framework mode (wizard path). Browser `Sentry.init` + `reactRouterTracingIntegration`, server init via `instrument.server.mjs` NODE_OPTIONS preload. NOTE: assumes Node server — adapt for CF Worker per `cloudflare.md`. | `Sentry.init`, `Sentry.reactRouterTracingIntegration`, `instrument.server.mjs`, `--import` preload |
| `react-router-manual-setup.md` | 24K | Manual (non-wizard) RR7 wire-up. Most-load-bearing file. Covers `entry.client.tsx` browser init, `entry.server.tsx` `createSentryHandleRequest` + `createSentryHandleError`, custom `handleRequest` w/ `getMetaTagTransformer` + `wrapSentryHandleRequest`, root `ErrorBoundary`, Vite plugin block, tunneling. | `Sentry.init`, `Sentry.reactRouterTracingIntegration`, `Sentry.createSentryHandleRequest`, `Sentry.createSentryHandleError`, `wrapSentryHandleRequest`, `getMetaTagTransformer`, `HandleErrorFunction`, `sentryVitePlugin` |
| `sourcemaps-vite.md` | 5.9K | Configuring `@sentry/vite-plugin` for source-map upload at build time. Auth-token via `SENTRY_AUTH_TOKEN`. Inject debug IDs + delete maps after upload. | `sentryVitePlugin({ org, project, authToken, sourcemaps: { filesToDeleteAfterUpload } })`, `SENTRY_AUTH_TOKEN` |
| `sourcemaps-troubleshooting.md` | 11K | Debugging missing/wrong source maps in the Sentry UI. Debug IDs, artifact mismatch, multiple projects, CSP, release mismatch. | `sentry-cli sourcemaps explain`, debug ID, artifact name, release |
| `dsn-explainer.md` | 4.3K | Picking the DSN — what it is, public-key vs auth-token boundary, why it's safe to ship in client bundles. Multi-project / multi-env DSN strategy. | DSN format, public key, project ID, ingest endpoint |

## DSN vs auth-token boundary (re-stated for the lazy)

- **DSN** (`https://<public-key>@<host>/<project-id>`) = write-only ingest endpoint. Safe in `.env.development` + `wrangler.jsonc` `vars` + client bundle. Project CLAUDE.md "Secrets locations" already calls this out: `SENTRY_DSN_PUBLIC` is `vars`-class, `VITE_SENTRY_DSN` is committed.
- **`SENTRY_AUTH_TOKEN`** = source-map upload credential, write-scoped to `project:releases`. NEVER ship to runtime. `wrangler secret put` only. Goes in Wrangler-secrets list once Phase 6.5 wires source-map upload.

## RR7 server entry on CF Worker — gotcha

`react-router-manual-setup.md` writes `instrument.server.mjs` and preloads via Node `NODE_OPTIONS=--import`. CF Workers have no `--import` flag. Use `withSentry` from `cloudflare.md` as the outermost wrap of the Worker's default export; pull RR7-specific helpers (`createSentryHandleRequest`, `createSentryHandleError`, `getMetaTagTransformer`) from `@sentry/react-router` directly inside `entry.server.tsx`. Server-side init lives inside the `withSentry` callback, not a separate preload module.

## When to fall through

- API signature uncertain, this mirror lacks it → `context7` MCP. Library IDs: `/getsentry/sentry-javascript` (covers `@sentry/cloudflare`, `@sentry/react-router`, `@sentry/vite-plugin`).
- Live status (current SDK version, current Cloudflare-Workers SDK release-channel) → `https://github.com/getsentry/sentry-javascript/releases/latest`.

## Refresh

1. `bash scripts/sync-sentry-docs.sh` — re-pulls all 8 pages + bumps `_snapshot_date.txt` + rewrites `_urls.txt`.
2. Spot-check no 404s in script output. Sentry restructures occasionally; update the `PAGES` array if a URL moves.

## Provenance

URLs listed in `_urls.txt`. Filename convention: kebab-case slug derived from URL path tail.
