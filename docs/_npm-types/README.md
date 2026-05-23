# npm type mirror

Mirrored `.d.ts` / `.d.cts` / `.d.mts` files from packages this project
depends on. Source of truth: `node_modules/<pkg>/`. Refreshed by
`scripts/sync-npm-types.sh`, which also runs on `bun install` via the
`postinstall` hook in `package.json`.

## Why this exists

Agents kept hallucinating named imports from subpaths that do not exist
(e.g. `import { JWTClaims } from "@supabase/server/core"` — those types
live at the package root). Grepping `docs/` for product docs missed it
because product docs do not list named exports. Mirroring the actual
`.d.ts` here gives a grep target that reflects reality.

## Rule of thumb

Before writing a named import from any package listed in
`scripts/sync-npm-types.sh`, grep `docs/_npm-types/<safe-name>/` for the
symbol. If it is not there, the import will not resolve.

`<safe-name>` replaces `/` with `__` — so `@supabase/server` becomes
`@supabase__server`.

## Refresh

```
bash scripts/sync-npm-types.sh
```

Snapshot date lives in `_snapshot_date.txt`.
