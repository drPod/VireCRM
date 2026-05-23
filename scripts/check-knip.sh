#!/usr/bin/env bash
# Dead-code detection via Knip. Warn-only — does NOT fail CI yet.
#
# Knip surfaces unused files, exports, dependencies, and type exports. On a
# fresh repo, expect false positives that need config tuning (e.g. dynamic
# imports, framework conventions Knip's plugins miss). Tune knip.json first,
# then promote this gate to a hard fail once the report is clean.
#
# Always exits 0 so it can be wired into CI with continue-on-error semantics
# without surprising the caller. Print the report to the log either way.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

set +e
bunx knip
status=$?
set -e

if [ "${status}" -eq 0 ]; then
  echo "check-knip: PASS"
else
  echo "check-knip: WARN (exit ${status}) — dead-code findings reported above (non-blocking)"
fi

exit 0
