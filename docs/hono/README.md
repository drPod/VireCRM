# Hono (web framework, used inside CF Worker for `/api/*`)

Snapshot: 2026-05-22
Origin: https://hono.dev

Vendor-mirrored docs for [Hono](https://hono.dev) — small, fast web framework built on Web Standards. Runs on Cloudflare Workers, Bun, Node.js, Deno, etc. In this project, Hono lives **inside the CF Worker** to route internal `/api/*` calls from the React Router v7 SPA.

Refresh via `scripts/sync-hono-docs.sh` (idempotent — re-fetches both files from `hono.dev`).

## Files

| File | Size | Consult when |
|---|---|---|
| `llms.txt` | ~5.4 KB | Quick index of all Hono doc pages. Start here to find the right deep-link. |
| `llms-full.txt` | ~347 KB | Full corpus (no examples). Search this for any API symbol, middleware name, or concept. |
| `_urls.txt` | — | Provenance: upstream URLs the sync script pulls from. |
| `_snapshot_date.txt` | — | When this mirror was last refreshed. |

## Key concepts to grep

- **`Hono` app** — root router instance. `new Hono()`, `app.route('/api', subRouter)`, `app.fetch` as Worker entry.
- **Middleware** — `app.use('*', middleware)`. Composable, order matters. Built-ins: logger, CORS, JWT, body-limit, IP restriction, basic-auth, bearer-auth, cache, compress, CSRF, ETag, secure-headers, timing, trailing-slash.
- **`c.json` / `c.text` / `c.html`** — Context response helpers. `c.json(data, status)`.
- **`c.req`** — Request accessor. `c.req.param('id')`, `c.req.query('q')`, `c.req.json()`, `c.req.valid('json')` after validator middleware.
- **JWT middleware** — `import { jwt } from 'hono/jwt'`. Use for protecting routes. For Supabase JWT verification (asymmetric ES256/RS256 per project rules), pair with `hono/jwt` `verify` helper or roll custom middleware reading JWKS.
- **Cloudflare Workers integration** — `export default app` (Hono app exposes `fetch`). Bindings reach handlers via `c.env`. Grep `# Cloudflare Workers` in `llms-full.txt`.
- **Type-safe RPC** — `app.get('/foo', handler)` returns a typed route; export `type AppType = typeof app` and consume in client via `hc<AppType>(url)`. Powers end-to-end type safety from Worker → SPA.
- **Validators** — `@hono/zod-validator` / `@hono/valibot-validator`. `app.post('/x', zValidator('json', schema), handler)`.
- **Error handling** — `app.onError((err, c) => ...)`. `HTTPException` for thrown HTTP errors. `app.notFound(...)` for 404 fallback.
- **Helpers** — `hono/jwt`, `hono/cookie`, `hono/html`, `hono/factory`, `hono/testing`, `hono/streaming`, `hono/adapter`.

## When to consult this mirror vs other sources

- Hono API symbol, middleware behavior, type-safe RPC pattern, CF Workers wiring → **this mirror first** (`llms-full.txt`).
- Hono release notes / "is X still supported" → `curl -s https://api.github.com/repos/honojs/hono/releases/latest` per `~/.claude/rules/lookups.md`.
- Other lib docs (React Router, Drizzle, Stripe, MS Graph, etc.) → `context7` MCP per project tool-routing rules.
