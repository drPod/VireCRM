#!/usr/bin/env bash
# Smoke-check the full production build (`bun run build` → `react-router build`).
# Catches Tailwind v4 directive errors, Vite plugin failures, and React Router
# route config drift (e.g. route file on disk but missing from app/routes.ts).
#
# On success: prints `check-build: PASS`, removes the build/ artifact, exits 0.
# On failure: prints `check-build: FAIL (exit N)`, leaves build/ for inspection,
# exits with the build's exit code.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

set +e
bun run build
status=$?
set -e

if [ "${status}" -ne 0 ]; then
  echo "check-build: FAIL (exit ${status})"
  exit "${status}"
fi

echo "check-build: PASS"
rm -rf build
