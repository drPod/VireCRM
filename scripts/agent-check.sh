#!/usr/bin/env bash
# Verify-before-done gate for agents.
#
# Runs the project's main static check (bun run typecheck = wrangler types &&
# react-router typegen && tsc -b). Prints a final one-line summary the agent
# can grep for ("agent-check: PASS" or "agent-check: FAIL (exit N)") and exits
# with the same code as the underlying typecheck.
#
# NODE_OPTIONS bumps the V8 heap to 6 GB — tsc -b on this repo SIGKILLs at the
# default ~4 GB once react-router typegen + wrangler types output is included.
# See docs/agent-prevention.md for the full rationale + the other 4 gates.

set -euo pipefail

cd "$(dirname "$0")/.."

export NODE_OPTIONS="--max-old-space-size=6144"

set +e
bun run typecheck
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "agent-check: PASS"
else
  echo "agent-check: FAIL (exit $status)"
fi

exit "$status"
