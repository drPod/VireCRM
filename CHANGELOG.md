# Changelog

All notable changes to this project are recorded here. Snapshot dates and version pins reflect when an upstream source was captured into the repo, not the release dates of the upstream packages themselves.

## [Unreleased]

### Added

- **Vendor doc mirrors** (snapshot `2026-05-22`) under `docs/<lib>/` for the 9 libraries the project lives in. Each ships a fat-router `README.md` plus primary content (`llms-full.txt`, `reference.md`, or per-page scrapes) plus `_urls.txt` provenance and `_snapshot_date.txt`. Refresh via `scripts/sync-<lib>-docs.sh`. Mirrored: `react-router-v7`, `cloudflare-vite-plugin`, `wrangler`, `supabase` (covers `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/server`), `stripe-node`, `microsoft-graph`, `hono`, `drizzle`, `dnd-kit` (pinned to `@dnd-kit/core@6.3.1`).
- `.env.example` template at repo root. Covers every `VITE_*` public var from tracked `.env.development` / `.env.production` plus every server-side secret name from `CLAUDE.md` "Secrets locations". Placeholders only — real secrets via `wrangler secret put`.

### Changed

- `CLAUDE.md` and `AGENTS.md` "Tool routing" now point at the local `docs/<lib>/` mirrors first, falling through to `context7` MCP only when the mirror lacks coverage.
