#!/usr/bin/env bash
# Biome lint/format gate — WARN-ONLY for now.
#
# Runs `biome ci .` (the CI-specific subcommand: no writes, exits non-zero
# on any violation). The wrapper deliberately returns 0 so this gate is
# visible-but-non-blocking until the autofix sweep lands.
#
# When ready to promote to blocking, change the final `exit 0` to `exit
# "$status"` (and flip `continue-on-error: true` off in .github/workflows/
# checks.yml).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

set +e
bunx --bun @biomejs/biome ci .
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "check-lint: PASS"
else
  echo "check-lint: WARN (exit $status — warn-only gate, not blocking)"
fi

exit 0
