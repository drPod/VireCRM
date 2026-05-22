#!/usr/bin/env bash
# Refresh docs/hono/ from upstream hono.dev.
# Idempotent: re-running pulls latest llms.txt + llms-full.txt and stamps _snapshot_date.txt.
set -euo pipefail

# Resolve repo root from this script's location (scripts/ lives at repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCS_DIR="${REPO_ROOT}/docs/hono"

mkdir -p "${DOCS_DIR}"

curl -fsSL https://hono.dev/llms.txt      -o "${DOCS_DIR}/llms.txt"      & pid_a=$!
curl -fsSL https://hono.dev/llms-full.txt -o "${DOCS_DIR}/llms-full.txt" & pid_b=$!
wait "${pid_a}"
wait "${pid_b}"

cat > "${DOCS_DIR}/_urls.txt" <<'EOF'
https://hono.dev/llms.txt
https://hono.dev/llms-full.txt
EOF

# Pinned snapshot date for this sync run. Override with SNAPSHOT_DATE env if refreshing.
SNAPSHOT_DATE="${SNAPSHOT_DATE:-2026-05-22}"
printf '%s\n' "${SNAPSHOT_DATE}" > "${DOCS_DIR}/_snapshot_date.txt"

echo "Synced Hono docs → ${DOCS_DIR} (snapshot ${SNAPSHOT_DATE})"
