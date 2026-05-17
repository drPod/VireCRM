#!/usr/bin/env bash
# Kill stray vite dev processes and restart fresh so updated .env loads.
#
# Vite bakes env vars (anything VITE_*) into the bundle at dev-server start.
# If you edit .env (e.g. swap VITE_SUPABASE_URL after migrating Supabase
# projects), running vite already keeps serving the stale values until you
# restart. Auth + service calls silently hit the wrong backend → "invalid
# credentials" / 401 / CORS errors that look like bugs but are stale env.
#
# Use this script after any .env edit instead of expecting HMR to handle it.

set -euo pipefail

cd "$(dirname "$0")/.."

# Kill anything serving vite on this project. `pkill` is per-user.
pkill -f "vite dev" 2>/dev/null || true
pkill -f "node.*vite/bin/vite.js dev" 2>/dev/null || true

# Brief pause so ports release.
sleep 1

# Resolve and print VITE_SUPABASE_URL so it's obvious which backend the
# new bundle is going to talk to. Read from .env (TanStack Start convention).
if [ -f .env ]; then
  echo "[restart-dev] Resolved env:"
  grep -E '^VITE_SUPABASE_URL=' .env || echo "  VITE_SUPABASE_URL (not set)"
  grep -E '^VITE_PUBLIC_BASE_URL=' .env 2>/dev/null || true
else
  echo "[restart-dev] WARNING: .env not found"
fi

echo "[restart-dev] Starting bun run dev …"
exec bun run dev
