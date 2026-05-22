#!/usr/bin/env bash
# Sync Drizzle ORM vendor docs into docs/drizzle/.
# Idempotent — safe to re-run. Refreshes llms.txt + llms-full.txt verbatim
# from upstream (https://orm.drizzle.team).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST="${REPO_ROOT}/docs/drizzle"

mkdir -p "${DEST}"

echo "Fetching Drizzle ORM llms.txt..."
curl -fsSL -o "${DEST}/llms.txt" https://orm.drizzle.team/llms.txt

echo "Fetching Drizzle ORM llms-full.txt..."
curl -fsSL -o "${DEST}/llms-full.txt" https://orm.drizzle.team/llms-full.txt

echo "Done. Files in ${DEST}:"
ls -lh "${DEST}/llms.txt" "${DEST}/llms-full.txt"
