#!/usr/bin/env bash
# Aggregate verification wrapper. Detects changed files via git diff vs HEAD,
# git diff --cached, and untracked-files (git ls-files --others --exclude-standard).
# Dispatches the right subset of the 5 gates from docs/agent-prevention.md.
#
# Usage: bash scripts/check-all.sh
# Exit: 0 = PASS (gates ran or none relevant). 1 = FAIL (one or more gate failed).
#
# Triggers (mirror docs/agent-prevention.md):
#   workers|app/**/*.{ts,tsx,mts,cts}                    -> agent-check.sh
#   workers/db/schema/**.ts OR drizzle/** new files       -> check-schema-drift.sh
#   wrangler.jsonc OR new c.env.* ref in workers/**.ts    -> check-worker-config.sh
#   vite.config* | tailwind.config* | app/routes.ts |
#     app/root.tsx | app/routes/** | app/**/*.css         -> check-build.sh
#   package.json | bun.lock                              -> sync-npm-types.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Collect changed files (unstaged + staged + untracked, deduped).
CHANGED="$(
  {
    git diff --name-only HEAD
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } | sort -u
)"

if [ -z "${CHANGED}" ]; then
  echo "check-all: SKIP (no changed files)"
  exit 0
fi

# Gate dispatch flags — set once per gate per run.
RUN_AGENT_CHECK=0
RUN_SCHEMA_DRIFT=0
RUN_WORKER_CONFIG=0
RUN_BUILD=0
RUN_NPM_TYPES=0

declare -a REASONS=()

# Set the named flag to 1 and record the reason — at most once per gate.
mark_gate() {
  local var="$1"; local reason="$2"
  if [ "${!var}" -eq 0 ]; then
    printf -v "$var" '%s' 1
    REASONS+=("$reason")
  fi
}

# Classify each changed file.
while IFS= read -r f; do
  [ -z "$f" ] && continue

  # agent-check: any TS/TSX under workers/ or app/.
  if [[ "$f" =~ ^(workers|app)/.+\.(ts|tsx|mts|cts)$ ]]; then
    mark_gate RUN_AGENT_CHECK "agent-check.sh (TS edit: $f)"
  fi

  # schema drift: schema TS edit OR any change under drizzle/.
  if [[ "$f" =~ ^workers/db/schema/.+\.ts$ ]] || [[ "$f" =~ ^drizzle/ ]]; then
    mark_gate RUN_SCHEMA_DRIFT "check-schema-drift.sh (schema/migration touched: $f)"
  fi

  # worker config: wrangler.jsonc edit, or a workers/**.ts file that
  # actually contains a `c.env.` reference (avoids Path-A on unrelated edits).
  if [ "$f" = "wrangler.jsonc" ]; then
    mark_gate RUN_WORKER_CONFIG "check-worker-config.sh (wrangler.jsonc edited)"
  elif [[ "$f" =~ ^workers/.+\.ts$ ]] && grep -q 'c\.env\.' "$f" 2>/dev/null; then
    mark_gate RUN_WORKER_CONFIG "check-worker-config.sh (c.env. ref in $f)"
  fi

  # build: vite / tailwind config, root route config, route files, or app CSS.
  if [[ "$f" =~ ^vite\.config ]] \
     || [[ "$f" =~ ^tailwind\.config ]] \
     || [ "$f" = "app/routes.ts" ] \
     || [ "$f" = "app/root.tsx" ] \
     || [[ "$f" =~ ^app/routes/ ]] \
     || [[ "$f" =~ ^app/.+\.css$ ]]; then
    mark_gate RUN_BUILD "check-build.sh (build-affecting change: $f)"
  fi

  # npm types: lockfile or manifest change.
  if [ "$f" = "package.json" ] || [ "$f" = "bun.lock" ]; then
    mark_gate RUN_NPM_TYPES "sync-npm-types.sh (dependency manifest changed: $f)"
  fi
done <<< "${CHANGED}"

TOTAL_DISPATCHED=$((RUN_AGENT_CHECK + RUN_SCHEMA_DRIFT + RUN_WORKER_CONFIG + RUN_BUILD + RUN_NPM_TYPES))

if [ "$TOTAL_DISPATCHED" -eq 0 ]; then
  echo "check-all: SKIP (no relevant changes)"
  exit 0
fi

echo "check-all: dispatching $TOTAL_DISPATCHED gate(s):"
for reason in "${REASONS[@]}"; do
  echo "  - $reason"
done
echo

declare -a FAILED=()
GATES_RAN=0

run_gate() {
  local name="$1"; shift
  echo "→ running $name"
  set +e
  "$@"
  local rc=$?
  set -e
  GATES_RAN=$((GATES_RAN + 1))
  if [ "$rc" -ne 0 ]; then
    FAILED+=("$name")
  fi
  echo
}

[ "$RUN_NPM_TYPES" -eq 1 ]     && run_gate "sync-npm-types.sh"      bash scripts/sync-npm-types.sh
[ "$RUN_SCHEMA_DRIFT" -eq 1 ]  && run_gate "check-schema-drift.sh"  bash scripts/check-schema-drift.sh
[ "$RUN_WORKER_CONFIG" -eq 1 ] && run_gate "check-worker-config.sh" bash scripts/check-worker-config.sh
[ "$RUN_BUILD" -eq 1 ]         && run_gate "check-build.sh"         bash scripts/check-build.sh
[ "$RUN_AGENT_CHECK" -eq 1 ]   && run_gate "agent-check.sh"         bash scripts/agent-check.sh

if [ "${#FAILED[@]}" -eq 0 ]; then
  echo "check-all: PASS ($GATES_RAN gates ran)"
  exit 0
else
  echo "check-all: FAIL (${FAILED[*]})"
  exit 1
fi
