#!/usr/bin/env bash
# Lint ISSUES.md structure.
#
# Catches:
#   1. Orphan `####` subsection in `## Recent` (no parent `### YYYY-MM-DD`).
#      This is the failure mode that lost the "docs reorg push" header on
#      2026-05-18 when commit d9a8381 rewrote an adjacent section.
#   2. Session header missing the `**Tags:** [...]` line — archive grep depends on tags.
#   3. Sessions in `## Recent` older than 14 days — archive candidate.
#
# Exits non-zero on bugs (#1, #2). Archive candidates are warnings only.
#
# Usage:
#   bash scripts/lint-issues.sh                # lint root ISSUES.md
#   bash scripts/lint-issues.sh path/to/file   # lint specific file

set -euo pipefail

FILE="${1:-ISSUES.md}"

if [[ ! -f "$FILE" ]]; then
  echo "lint-issues: not found: $FILE" >&2
  exit 2
fi

# 14-day cutoff for archive candidates. Use GNU date if available, BSD date fallback.
if date -d "14 days ago" +%Y-%m-%d >/dev/null 2>&1; then
  CUTOFF=$(date -d "14 days ago" +%Y-%m-%d)
else
  CUTOFF=$(date -v-14d +%Y-%m-%d)
fi

awk -v cutoff="$CUTOFF" '
  BEGIN { section = ""; last_h3 = ""; tagged = 0; errors = 0; warnings = 0; in_recent = 0; in_template = 0 }

  # Track top-level section.
  /^## / {
    section = $0
    last_h3 = ""
    tagged = 0
    in_recent = ($0 ~ /^## Recent/) ? 1 : 0
    in_template = ($0 ~ /^## How to append/) ? 1 : 0
    next
  }

  # H3 inside Recent: must match `### YYYY-MM-DD — title`.
  /^### / && in_recent {
    # Skipping H3s that are inline doc subsections inside Recent (none expected by spec, but be conservative).
    # Validate prior H3 had tags.
    if (last_h3 != "" && !tagged) {
      printf "ERROR  %s:%d  session header missing **Tags:** line — %s\n", FILENAME, last_h3_line, last_h3
      errors++
    }
    last_h3 = $0
    last_h3_line = NR
    tagged = 0

    # Date check — extract YYYY-MM-DD via substr after "### ".
    rest = substr($0, 5)
    if (rest ~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}/) {
      date = substr(rest, 1, 10)
      if (date < cutoff) {
        printf "WARN   %s:%d  section >14d old, archive candidate — %s\n", FILENAME, NR, $0
        warnings++
      }
    } else {
      printf "ERROR  %s:%d  H3 in ## Recent not in `### YYYY-MM-DD — title` form — %s\n", FILENAME, NR, $0
      errors++
    }
    next
  }

  # Tag line right under H3.
  /^\*\*Tags:\*\*/ && in_recent {
    tagged = 1
    next
  }

  # H4 inside Recent must have a parent H3 (YYYY-MM-DD session). Skip template block.
  /^#### / && in_recent && !in_template {
    if (last_h3 == "") {
      printf "ERROR  %s:%d  orphan #### subsection with no parent ### YYYY-MM-DD — %s\n", FILENAME, NR, $0
      errors++
    }
    next
  }

  END {
    # Tail check — last H3 in Recent should also be tagged.
    if (last_h3 != "" && !tagged) {
      printf "ERROR  %s:%d  session header missing **Tags:** line — %s\n", FILENAME, last_h3_line, last_h3
      errors++
    }
    if (errors > 0) {
      printf "\n%d error(s), %d warning(s)\n", errors, warnings
      exit 1
    }
    if (warnings > 0) {
      printf "\n0 errors, %d warning(s)\n", warnings
    } else {
      printf "lint-issues: OK (%s)\n", FILENAME
    }
  }
' "$FILE"
