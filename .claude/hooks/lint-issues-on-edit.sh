#!/usr/bin/env bash
# Claude Code PostToolUse hook — lints ISSUES.md after every Edit/Write.
#
# Wired via .claude/settings.json (project-local, tracked). Fires after
# Edit / Write / MultiEdit tool calls. Short-circuits unless the edited
# file is ISSUES.md.
#
# CC contract (https://code.claude.com/docs/en/hooks-guide):
#  - stdin: JSON with {tool_name, tool_input.file_path, tool_response, ...}
#  - exit 0  : silent success
#  - exit 2  : BLOCK and feed stderr back to the agent (agent can correct)
#  - other   : non-blocking, stderr printed
#
# We use exit 2 on lint failure so the agent sees the error inline and
# corrects without waiting for the git pre-commit gate.
#
# Layered with .githooks/pre-commit (catches non-CC agents at commit time)
# — both hooks invoke the same scripts/lint-issues.sh, so semantics match.

set -euo pipefail

# Read CC's JSON envelope from stdin.
payload=$(cat)

# Extract edited file path. jq present in CC's runtime per docs; fall back to
# python for robustness.
if command -v jq >/dev/null 2>&1; then
  file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')
else
  file_path=$(printf '%s' "$payload" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))')
fi

# Short-circuit: not an ISSUES.md edit → silent pass.
if [[ -z "$file_path" || "$(basename "$file_path")" != "ISSUES.md" ]]; then
  exit 0
fi

# Resolve repo root from script location (.claude/hooks/script.sh → repo root).
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

# Only act on edits inside this repo. (Agent might edit an ISSUES.md from a
# different project in the same session — let that one's own hook handle it.)
case "$file_path" in
  "$repo_root"/*) ;;
  *) exit 0 ;;
esac

lint="$repo_root/scripts/lint-issues.sh"
if [[ ! -x "$lint" ]]; then
  echo "lint-issues-on-edit: $lint missing or not executable" >&2
  exit 2
fi

# Capture output. On failure, surface to agent with exit 2.
if output=$(bash "$lint" "$file_path" 2>&1); then
  # Pass — silent unless warnings present (warnings still exit 0 from the lint).
  if printf '%s' "$output" | grep -q '^WARN'; then
    printf '%s\n' "$output" >&2
  fi
  exit 0
fi

cat >&2 <<EOF
ISSUES.md lint failed after Edit/Write:

$output

Fix before continuing. Common causes:
  - Orphan #### subsection with no parent ### YYYY-MM-DD — title
  - Session header missing **Tags:** [foo] [bar] line directly below the date
  - Wrong heading level (sessions are ### / subsections are ####)

Full protocol: ISSUES.md "How to append".
EOF
exit 2
