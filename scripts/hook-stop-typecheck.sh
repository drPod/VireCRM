#!/usr/bin/env bash
# Stop hook: block Claude Code from declaring done when any static-contract
# gate fails. Wired in .claude/settings.json under hooks.Stop.
#
# Delegates to scripts/check-all.sh, which inspects the working tree (staged
# + unstaged + untracked) and dispatches only the gates whose triggers match.
# Result: zero cost when nothing relevant changed, full cost only when it did.
#
# Receives Stop event JSON on stdin; reads stop_hook_active to avoid infinite
# loop (Claude Code docs: don't re-block after the agent has been told to
# continue).
#
# Exit:
#   0 — gates passed or none relevant; agent may stop.
#   2 — at least one gate failed; agent must keep working.
set -uo pipefail

input="$(cat || true)"

if [[ "${input}" == *'"stop_hook_active":true'* ]]; then
  exit 0
fi

repo="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "${repo}"

if bash scripts/check-all.sh >&2; then
  exit 0
fi

cat >&2 <<'MSG'

[stop-hook] One or more static-contract gates failed. Do not stop with a broken tree.
            Fix the failures above, then re-run: bash scripts/check-all.sh
            Enforcement layer: .claude/settings.json -> hooks.Stop
MSG
exit 2
