#!/usr/bin/env bash
# Mirror npm package .d.ts files into docs/_npm-types/ so agents can grep
# real exports before writing named imports.
#
# Idempotent — wipes each per-package output dir before repopulating. Skips
# nested node_modules (transitive deps). Listed packages must match what
# CLAUDE.md tells agents to grep here before importing.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/_npm-types"
MODULES="$ROOT/node_modules"

PKGS=(
  "@supabase/server"
  "@supabase/supabase-js"
  "drizzle-orm"
  "drizzle-kit"
  "hono"
  "react-router"
  "@react-router/dev"
  "stripe"
  "@microsoft/microsoft-graph-client"
  "@microsoft/microsoft-graph-types"
  "@dnd-kit/core"
  "@dnd-kit/sortable"
  "zod"
  "postgres"
  "@sentry/cloudflare"
  "@sentry/react-router"
  "@sentry/vite-plugin"
)

mkdir -p "$OUT"

for pkg in "${PKGS[@]}"; do
  safe="${pkg//\//__}"
  src="$MODULES/$pkg"
  dest="$OUT/$safe"

  if [[ ! -d "$src" ]]; then
    echo "warn: $pkg not installed at $src — skipping" >&2
    continue
  fi

  rm -rf "$dest"
  mkdir -p "$dest"

  # Copy every .d.ts / .d.cts / .d.mts under the package, preserving structure,
  # but skip any nested node_modules (transitive deps).
  count=0
  while IFS= read -r -d '' file; do
    rel="${file#$src/}"
    target="$dest/$rel"
    mkdir -p "$(dirname "$target")"
    cp "$file" "$target"
    count=$((count + 1))
  done < <(find "$src" -type d -name node_modules -prune -o \
             -type f \( -name '*.d.ts' -o -name '*.d.cts' -o -name '*.d.mts' \) -print0)

  echo "mirrored $pkg -> $dest ($count files)"
done

date -u +%Y-%m-%d > "$OUT/_snapshot_date.txt"

cat > "$OUT/README.md" <<'EOF'
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
EOF

echo "snapshot date: $(cat "$OUT/_snapshot_date.txt")"
echo "done. tree at $OUT"
