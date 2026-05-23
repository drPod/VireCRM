#!/usr/bin/env bash
# Mirror npm package TypeScript declaration files into docs/_npm-types/.
#
# Why: agents grep docs/<lib>/ for symbol names (product docs) and conclude
# "checked, looks fine" when symbols actually live in node_modules/<pkg>/**/*.d.ts.
# This mirror gives ground-truth named exports without shipping all of node_modules.
#
# Idempotent — wipes per-pkg dir then re-copies. Safe to run repeatedly.
# Auto-runs via `postinstall` after `bun install`; also hand-runnable.
#
# Distinct from docs/<lib>/ (product docs — usage + concepts, no .d.ts).
# Slash in pkg name → __ so @supabase/server becomes @supabase__server.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NM="$ROOT/node_modules"
OUT="$ROOT/docs/_npm-types"

declare -a PKGS=(
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
)

mkdir -p "$OUT"

for pkg in "${PKGS[@]}"; do
  src="$NM/$pkg"
  if [ ! -d "$src" ]; then
    echo "skip $pkg (not installed)" >&2
    continue
  fi
  safe="${pkg//\//__}"
  dst="$OUT/$safe"
  rm -rf "$dst"
  count=0
  # Find .d.ts/.d.cts/.d.mts, excluding any nested node_modules. Copy preserving
  # the relative tree under src/ into dst/.
  while IFS= read -r -d '' f; do
    rel="${f#"$src/"}"
    mkdir -p "$dst/$(dirname "$rel")"
    cp "$f" "$dst/$rel"
    count=$((count + 1))
  done < <(find "$src" -type d -name node_modules -prune -o \
                       -type f \( -name '*.d.ts' -o -name '*.d.cts' -o -name '*.d.mts' \) -print0)
  echo "synced $pkg ($count files) -> docs/_npm-types/$safe/"
done

date -u +%Y-%m-%d > "$OUT/_snapshot_date.txt"
echo "snapshot date: $(cat "$OUT/_snapshot_date.txt")"
