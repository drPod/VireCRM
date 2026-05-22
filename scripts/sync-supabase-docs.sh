#!/usr/bin/env bash
# Sync Supabase JS ecosystem docs (@supabase/supabase-js, @supabase/ssr, @supabase/server).
#
# Idempotent — re-run to refresh. URLs are tracked in docs/supabase/_urls.txt.
# Snapshot date lives in docs/supabase/_snapshot_date.txt — bump it when refreshing.
#
# NOTE: the context7 portion (reference.md from MCP query-docs) must be regenerated
# via Claude Code's context7 MCP — this shell script handles only the upstream URL pulls.
# TODO: when supabase ships a CLI for doc dumps or stabilizes llms-full.txt under
# a manageable size, replace the per-URL pulls below with a single call.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/supabase"
mkdir -p "$OUT"

# Page-by-page canonical pulls. Supabase appends ".md" to docs URLs to serve raw markdown.
# JS reference page (/docs/reference/javascript/initializing) has no .md endpoint — drop it
# and rely on context7-generated reference.md instead. See _urls.txt for status.
# llms-index.md is the upstream nav index (https://supabase.com/llms.txt), kept so re-runs
# stay idempotent for the whole mirror.
declare -a PAGES=(
  "llms-index|https://supabase.com/llms.txt"
  "creating-a-client|https://supabase.com/docs/guides/auth/server-side/creating-a-client.md"
  "jwts|https://supabase.com/docs/guides/auth/jwts.md"
  "row-level-security|https://supabase.com/docs/guides/database/postgres/row-level-security.md"
  "storage|https://supabase.com/docs/guides/storage.md"
  "vault|https://supabase.com/docs/guides/database/vault.md"
)

for entry in "${PAGES[@]}"; do
  name="${entry%%|*}"
  url="${entry##*|}"
  echo "Fetching $name <- $url"
  curl -fsSL -o "$OUT/$name.md" "$url"
done

echo "Done. Files in $OUT:"
ls -lh "$OUT"
