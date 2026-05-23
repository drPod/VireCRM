#!/usr/bin/env bash
# agent-check.sh — verify-before-done typecheck gate.
#
# Runs `bun run typecheck` (currently `wrangler types && react-router typegen
# && tsc -b`) with NODE_OPTIONS raised to 6 GB. An earlier `tsc -b` SIGKILL'd
# at Node's default 4 GB heap on this repo; 6 GB is safe headroom.
#
# Captures stdout + stderr to a tempfile so a Stop-hook wrapper (Unit 8) can
# splice the tail of the output into the hook's `reason` field. On pass we
# print one grep-able summary line; on failure we tee the captured log to
# stderr and exit with tsc's original code.
#
# Hand-runnable from any cwd inside the repo — we resolve the repo root via
# `git rev-parse --show-toplevel` and cd there before invoking bun.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

log_file="$(mktemp -t agent-check.XXXXXX)"
trap 'rm -f "$log_file"' EXIT

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=6144"

set +e
bun run typecheck >"$log_file" 2>&1
exit_code=$?
set -e

if [ "$exit_code" -eq 0 ]; then
  echo "[agent-check] typecheck passed"
  exit 0
fi

cat "$log_file" >&2
echo "[agent-check] typecheck FAILED" >&2
exit "$exit_code"
