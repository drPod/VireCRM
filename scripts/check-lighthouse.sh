#!/usr/bin/env bash
# Local entry point for Lighthouse CI. Runs `bunx @lhci/cli autorun`, which:
#   1. Starts `bunx wrangler dev --port 8787` (per lighthouserc.json).
#   2. Waits for "Ready on http" stdout line.
#   3. Runs 3 Lighthouse passes against http://localhost:8787/.
#   4. Asserts thresholds from lighthouserc.json (warn-only on perf, error
#      on accessibility < 0.9).
#   5. Uploads reports to temporary-public-storage.
#
# Requires: `bun run build` to have produced the SPA bundle first; wrangler
# dev serves from build/.
#
# Usage: bash scripts/check-lighthouse.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

bunx @lhci/cli autorun
