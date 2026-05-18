#!/usr/bin/env bash
# Activate the repo's tracked git hooks (`.githooks/`).
#
# Git ignores hooks in versioned dirs by default — they live in `.git/hooks/`
# which is not under version control. Setting `core.hooksPath` redirects git
# to a tracked directory, so the hook is the same for every clone.
#
# Idempotent. Re-run safe. Solo dev: run once per fresh clone.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "install-hooks: not inside a git repo" >&2
  exit 1
}
cd "$REPO_ROOT"

if [[ ! -d .githooks ]]; then
  echo "install-hooks: .githooks/ not found at $REPO_ROOT" >&2
  exit 1
fi

# Ensure all hook files are executable. Catches the "chmod lost in zip download" case.
find .githooks -type f -not -name '*.md' -exec chmod +x {} \;

current=$(git config --get core.hooksPath 2>/dev/null || echo "")
target=".githooks"

if [[ "$current" == "$target" ]]; then
  echo "install-hooks: core.hooksPath already set to $target — nothing to do"
else
  git config core.hooksPath "$target"
  echo "install-hooks: core.hooksPath -> $target"
fi

echo "install-hooks: active hooks:"
ls -1 .githooks/ | grep -v '\.md$' | sed 's/^/  /'
