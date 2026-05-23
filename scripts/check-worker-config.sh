#!/usr/bin/env bash
# Detect wrangler-config / binding-reference drift.
#
# An agent can hallucinate a binding by writing `c.env.NEW_BINDING` without
# wiring `wrangler.jsonc` to provide it. This script catches that gap before
# the Worker ships to prod.
#
# Two paths:
#   A. `wrangler deploy --dry-run --outdir=.wrangler-check`
#      Validates config + bindings end-to-end. Preferred when it can run.
#      In this repo, requires `react-router build` to have produced the
#      virtual server-build entry — so dry-run only works in a CI/build
#      context. Also falls through on missing CF creds.
#   B. `wrangler types` regenerates `worker-configuration.d.ts` (the canonical
#      `Env` interface), then `tsc -b` typechecks the composite project. A
#      missing binding shows up as `Property '<X>' does not exist on type 'Env'`.
#
# Usage: bash scripts/check-worker-config.sh
#
# Exit 0 on success. Nonzero with a `FAIL` line on a real binding/config drift.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CHECK_DIR="$REPO_ROOT/.wrangler-check"
TMP_LOG="$(mktemp -t check-worker-config.XXXXXX)"
trap 'rm -f "$TMP_LOG"; rm -rf "$CHECK_DIR"' EXIT

# Strings that mean Path A can't run in this environment — fall through
# rather than treating as a real binding/config error.
#
#   - First four: missing CF credentials (per spec).
#   - virtual:react-router/server-build: framework-mode Worker entry that
#     only resolves after `react-router build`; wrangler dry-run runs esbuild
#     directly and chokes on the virtual module.
#   - do not share the same base path: worktree quirk when the parent repo
#     has its own .wrangler/deploy/config.json with a mismatched base.
PATH_A_FALLTHROUGH_PATTERNS=(
  "Authentication error"
  "not logged in"
  "CLOUDFLARE_API_TOKEN"
  "Cannot find your account"
  "virtual:react-router/server-build"
  "do not share the same base path"
)

# Run a command, capturing combined output to $TMP_LOG. On nonzero exit:
# dump the log to stderr, print a FAIL line, exit with the command's code.
# Caller can inspect $? and $TMP_LOG without re-running.
run_step() {
  local label="$1"; shift
  echo "[check-worker-config] $label"
  set +e
  "$@" >"$TMP_LOG" 2>&1
  local rc=$?
  set -e
  return "$rc"
}

fail() {
  local message="$1"; local rc="$2"
  cat "$TMP_LOG" >&2
  echo "check-worker-config: FAIL ($message)" >&2
  exit "$rc"
}

path_a_unavailable() {
  local pat
  for pat in "${PATH_A_FALLTHROUGH_PATTERNS[@]}"; do
    grep -qF -- "$pat" "$TMP_LOG" && return 0
  done
  return 1
}

# --- Path A.
if run_step "trying Path A: wrangler deploy --dry-run" \
    bunx wrangler deploy --dry-run --outdir=.wrangler-check; then
  echo "check-worker-config: PASS (path: A)"
  exit 0
fi
path_a_rc=$?

if ! path_a_unavailable; then
  fail "wrangler dry-run failed" "$path_a_rc"
fi
echo "[check-worker-config] Path A unavailable, falling through to Path B"

# --- Path B.
run_step "regenerating Env types via wrangler types" \
  bunx wrangler types \
  || fail "wrangler types regeneration failed" "$?"

run_step "running react-router typegen for composite project" \
  bunx react-router typegen \
  || fail "react-router typegen failed" "$?"

NODE_OPTIONS=--max-old-space-size=6144 \
  run_step "typechecking against regenerated Env" \
  bunx tsc -b --force \
  || fail "typecheck against generated Env failed" "$?"

echo "check-worker-config: PASS (path: B)"
exit 0
