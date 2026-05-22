# Supabase JS (`@supabase/supabase-js`, `@supabase/ssr`, `@supabase/server`)

**Snapshot:** 2026-05-22
**Origin:** https://supabase.com/docs
**Refresh:** `bash scripts/sync-supabase-docs.sh` (curl-pulled pages). `reference.md` regenerated separately via Claude Code's context7 MCP — see TODO in sync script.

This mirror covers the three JS packages this project depends on for Postgres + Auth + Storage + Vault: `@supabase/supabase-js` (browser client + low-level API), `@supabase/ssr` (cookie-aware server client for SSR frameworks like React Router v7), and `@supabase/server` (helpers for JWT verification in the Worker).

Read order for a Worker / SSR auth flow: `creating-a-client.md` → `jwts.md` → `row-level-security.md` → `reference.md` for code snippets.

## Files

| File | Size | When to consult | Key symbols |
|------|------|-----------------|-------------|
| `creating-a-client.md` | 19K | Setting up the Supabase client in the Worker or SPA. Covers SSR cookie handlers across Next.js / SvelteKit / Remix / Express / Hono / etc. | `createClient`, `createBrowserClient`, `createServerClient`, cookie `getAll` / `setAll` adapters |
| `jwts.md` | 12K | Verifying Supabase-issued JWTs in the Worker, picking signing-key algorithm, configuring JWKS edge caching, deciding `getSession` vs `getUser` vs `getClaims`. | ES256, RS256, HS256 (avoid), JWKS endpoint, signing-key rotation, `getClaims()` |
| `row-level-security.md` | 24K | Writing RLS policies for the 9 domain tables. `tenant_id`-keyed policies, `(SELECT auth.uid())` memoization, performance tips. | `CREATE POLICY`, `auth.uid()`, `auth.jwt()`, `USING` / `WITH CHECK`, `app_metadata.tenant_id` |
| `storage.md` | 3.0K | LOA + commission PDFs storage. Bucket types, signed URLs, RLS on storage. | buckets, `createSignedUrl`, image transformations |
| `vault.md` | 8.8K | Encrypting per-agent OAuth refresh tokens at rest. libsodium AEAD, key management. | `vault.create_secret`, `vault.decrypted_secrets`, Key IDs |
| `reference.md` | 16K | API-shaped reference for `@supabase/supabase-js` + `@supabase/ssr`. Code-snippet heavy. Generated via context7 MCP. | `createClient`, `createServerClient`, `createBrowserClient`, `getUser(jwt?)`, `skipAutoInitialize`, `parseCookieHeader`, `serializeCookieHeader`, `createSignedUrl` |
| `llms-index.md` | 1.2K | Upstream `llms.txt` — flat nav index pointing at every Supabase doc page. Use to discover URLs not mirrored here. | — |

## When to WebFetch instead

Anything not in this mirror — extensions, Edge Functions, Realtime, CLI flags. Prefer `https://supabase.com/docs/<path>.md` (raw markdown endpoint) over the HTML page.

## When to use context7

Anything API-shaped that needs version-pinned code samples. `/supabase/supabase-js` and `/supabase/ssr` are both indexed with high reputation and 100s of snippets each. `reference.md` is one such pull, but for ad-hoc lookups query directly.

## Refresh procedure

1. Re-run `bash scripts/sync-supabase-docs.sh` — refreshes the 5 page-by-page pulls + `llms-index.md`.
2. Regenerate `reference.md` via context7 MCP — see TODO comment block at the top of the sync script.
3. Bump `_snapshot_date.txt`.
4. Spot-check that no upstream URLs 404'd; if any did, update `_urls.txt` with the `DROPPED-404` flag and reroute via context7.
