# Wrangler (Cloudflare Workers CLI + config)

**Snapshot:** 2026-05-22
**Origin:** <https://developers.cloudflare.com/workers/wrangler>
**Refresh:** `bash scripts/sync-wrangler-docs.sh`

Vendor doc mirror so the worker / config / deploy layer can be read offline,
version-pinned, and without per-question WebFetch round-trips. Contents are
verbatim upstream markdown — do not edit by hand.

## When to consult this folder

- About to write or change `wrangler.jsonc`, secrets, routes, Hyperdrive,
  compatibility flags, or any binding declaration.
- Need to know what `wrangler <command>` actually does, what flags it
  accepts, and what side-effects it has on production.
- Wiring a new Workers binding (R2, KV, D1, Queues, Vectorize, Hyperdrive,
  Secrets Store, Service Bindings, Containers, etc.).
- Setting up `wrangler dev`, remote bindings, multi-worker dev, or local
  state.

For everything else (general Workers runtime APIs, fetch handlers, asset
serving, etc.) reach for `context7` / WebFetch — this mirror is intentionally
scoped to Wrangler CLI + Workers configuration.

## Files

| File | Size | Consult when… |
|---|---|---|
| `llms-wrangler.md` | 1.0M | Default first read. Full text of every page under `/workers/wrangler/*` and `/workers/configuration/*` sliced from CF `llms-full.txt`. Search this file before reaching for sub-pages. |
| `wrangler-commands.md` | 3.8K | Just need the index of command groups + how `wrangler <command> <subcommand>` parses. Lists every command surface (artifacts, browser, certificates, containers, d1, hyperdrive, kv, pages, pipelines, queues, r2, secrets-store, tunnel, vectorize, vpc, workers, workers-for-platforms, workflows). |
| `wrangler-configuration.md` | 89K | THE big one. Every key in `wrangler.jsonc` / `wrangler.toml`: top-level metadata, environments, bindings (KV, R2, D1, Queues, Vectorize, Hyperdrive, AI, Secrets Store, Browser, MTLS, Analytics Engine, Service Bindings, Durable Objects, Dispatch Namespaces, Email, Tail Consumers, Workflows, Containers, VPC, Pipelines, Assets), build, dev, observability, placement, routes, triggers, vars, version_metadata. Cross-reference here before adding any binding. |
| `wrangler-system-environment-variables.md` | 14K | What `WRANGLER_LOG`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_CF_FETCH_ENABLED` and the rest do, plus deprecated `CF_*` variants. |
| `workers-configuration-secrets.md` | 13K | `wrangler secret put / list / delete / bulk`, secret stores, plaintext vs encrypted vars, multi-environment secrets, when to use Secrets Store vs `vars` vs `wrangler secret` vs Cloudflare dashboard. |
| `workers-configuration-routing.md` | 2.6K | Routes vs custom domains vs workers.dev. Reference for `[[routes]]` table and zone matching rules. |
| `workers-configuration-compatibility-dates.md` | 4.9K | How `compatibility_date` interacts with the Workers runtime, plus the `compatibility_flags` array. |
| `_urls.txt` | 779B | Provenance — every upstream URL feeding this mirror. |
| `_snapshot_date.txt` | 11B | Single line: snapshot date. Bump on every sync. |

## Key commands cheat-sheet

```
# Local dev (auto-reload, port 8787 default).
wrangler dev
wrangler dev --remote          # remote bindings + isolate
wrangler dev -c path/to/wrangler.jsonc -c path/to/other/wrangler.jsonc

# Deploy.
wrangler deploy                # current entrypoint
wrangler deploy --dry-run --outdir build
wrangler deploy --env production

# Secrets (per-environment, server-side encrypted).
wrangler secret put MY_SECRET
wrangler secret list
wrangler secret delete MY_SECRET
wrangler secret bulk path/to/secrets.json

# Logs.
wrangler tail                  # stream logs
wrangler tail --format pretty --status error

# Hyperdrive (the Postgres pool binding this project uses day 1).
wrangler hyperdrive create my-db --connection-string="..."
wrangler hyperdrive list
wrangler hyperdrive update <id> ...

# Bindings reference: see wrangler-configuration.md for syntax.
```

## Route table format (reference)

In `wrangler.jsonc`, routes can be:

```jsonc
{
  "routes": [
    { "pattern": "example.com/*", "zone_name": "example.com" },
    { "pattern": "api.example.com/*", "zone_id": "<zone-id>", "custom_domain": true }
  ]
}
```

Full semantics + edge cases live in `workers-configuration-routing.md`.

## Refreshing this mirror

1. `bash scripts/sync-wrangler-docs.sh`
2. Update `_snapshot_date.txt` (the script does this for you — bump
   `SNAPSHOT_DATE` at the top of the script if today's date should win).
3. Commit the diff.

The script streams the 47 MB `llms-full.txt` through a Python slicer; the
full file never lands on disk. Sub-pages are fetched as canonical `index.md`
URLs directly from `developers.cloudflare.com`.
