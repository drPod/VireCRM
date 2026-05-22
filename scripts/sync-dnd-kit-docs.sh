#!/usr/bin/env bash
# Sync @dnd-kit/core v6.3.1 vendor docs into docs/dnd-kit/.
#
# Idempotent: safe to re-run; overwrites in place.
#
# Sources:
#   1. GitHub raw at tag @dnd-kit/core@6.3.1 — package READMEs + CHANGELOG.
#   2. Astro-rendered legacy site https://dndkit.com/legacy/... — HTML →
#      pandoc → cleanup pipeline. v6 was originally on GitBook; the site
#      now serves those same docs under /legacy/.
#
# context7 portion (reference.md) must be regenerated via Claude Code's
# context7 MCP — there is no public CLI for that yet.
# TODO: replace `reference.md` regen with a CLI call once context7
#       publishes one.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${ROOT}/docs/dnd-kit"
SNAPSHOT_DATE="2026-05-22"
VERSION="6.3.1"
TAG_ENC="%40dnd-kit/core%40${VERSION}"
RAW="https://raw.githubusercontent.com/clauderic/dnd-kit/${TAG_ENC}"
SITE="https://dndkit.com/legacy"

mkdir -p "${DEST}"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }
}
need curl
need pandoc
need python3

# 1) Package READMEs + core CHANGELOG (verbatim from tag).
fetch_raw() {
  local src="$1" dst="$2"
  echo "  raw  ${src}"
  curl -fsSL "${RAW}/${src}" -o "${DEST}/${dst}"
}

fetch_raw "README.md"                        "package-readme.md"
fetch_raw "packages/core/README.md"          "core-readme.md"
fetch_raw "packages/sortable/README.md"      "sortable-readme.md"
fetch_raw "packages/modifiers/README.md"     "modifiers-readme.md"
fetch_raw "packages/utilities/README.md"     "utilities-readme.md"
fetch_raw "packages/accessibility/README.md" "accessibility-readme.md"
fetch_raw "packages/core/CHANGELOG.md"       "core-changelog.md"

# 2) Legacy site HTML pages → markdown.
#    Strip Astro chrome (nav, footer, copy-page buttons, base64 SVG icons).
fetch_html() {
  local path="$1" dst="$2"
  local url="${SITE}/${path}/"
  echo "  html ${url}"
  curl -fsSL "${url}" \
    | python3 -c '
import sys, re
html = sys.stdin.read()
# Prefer the inner article body (mdx-content) if present; else fall back to <main>.
m = re.search(r"<div class=\"mdx-content[^\"]*\">(.*?)</div>\s*</div>\s*</div>\s*</main>", html, re.DOTALL)
if not m:
    m = re.search(r"<main[^>]*>(.*?)</main>", html, re.DOTALL)
print(m.group(1) if m else html)
' \
    | pandoc -f html -t gfm --wrap=none 2>/dev/null \
    | sed -E \
        -e 's/!\[[^]]*\]\(data:image\/[^)]+\)//g' \
        -e '/<img[[:space:]]+src="data:image\/[^"]+"/d' \
        -e '/<span[^>]*style="display:inline-block;width:16px/d' \
        -e '/^<\/?div[^>]*>$/d' \
        -e '/^<\/?span[^>]*>$/d' \
    | awk 'NF || prev { print; prev = NF }' \
    > "${DEST}/${dst}"
}

# These pages exist under /legacy/ as of the snapshot date.
fetch_html "introduction/getting-started"                              "01-getting-started.md"
fetch_html "introduction/installation"                                 "02-installation.md"
fetch_html "api-documentation/context-provider/dnd-context"            "03-dnd-context.md"
fetch_html "api-documentation/context-provider/collision-detection-algorithms" "04-collision-detection.md"
fetch_html "api-documentation/context-provider/use-dnd-monitor"        "05-use-dnd-monitor.md"
fetch_html "api-documentation/draggable"                               "06-draggable.md"
fetch_html "api-documentation/draggable/use-draggable"                 "07-use-draggable.md"
fetch_html "api-documentation/draggable/drag-overlay"                  "08-drag-overlay.md"
fetch_html "api-documentation/droppable"                               "09-droppable.md"
fetch_html "api-documentation/droppable/use-droppable"                 "10-use-droppable.md"
fetch_html "api-documentation/sensors"                                 "11-sensors.md"
fetch_html "api-documentation/sensors/pointer"                         "12-sensor-pointer.md"
fetch_html "api-documentation/sensors/keyboard"                        "13-sensor-keyboard.md"
fetch_html "api-documentation/sensors/mouse"                           "14-sensor-mouse.md"
fetch_html "api-documentation/sensors/touch"                           "15-sensor-touch.md"
fetch_html "api-documentation/modifiers"                               "16-modifiers.md"
fetch_html "guides/accessibility"                                      "17-accessibility-guide.md"

# 3) Provenance + snapshot stamp.
cat > "${DEST}/_urls.txt" <<EOF
# @dnd-kit/core@${VERSION} — pinned per CLAUDE.md stack invariants
# snapshot: ${SNAPSHOT_DATE}

# GitHub raw at tag @dnd-kit/core@${VERSION}
${RAW}/README.md
${RAW}/packages/core/README.md
${RAW}/packages/sortable/README.md
${RAW}/packages/modifiers/README.md
${RAW}/packages/utilities/README.md
${RAW}/packages/accessibility/README.md
${RAW}/packages/core/CHANGELOG.md

# Legacy site (v6 docs)
${SITE}/introduction/getting-started/
${SITE}/introduction/installation/
${SITE}/api-documentation/context-provider/dnd-context/
${SITE}/api-documentation/context-provider/collision-detection-algorithms/
${SITE}/api-documentation/context-provider/use-dnd-monitor/
${SITE}/api-documentation/draggable/
${SITE}/api-documentation/draggable/use-draggable/
${SITE}/api-documentation/draggable/drag-overlay/
${SITE}/api-documentation/droppable/
${SITE}/api-documentation/droppable/use-droppable/
${SITE}/api-documentation/sensors/
${SITE}/api-documentation/sensors/pointer/
${SITE}/api-documentation/sensors/keyboard/
${SITE}/api-documentation/sensors/mouse/
${SITE}/api-documentation/sensors/touch/
${SITE}/api-documentation/modifiers/
${SITE}/guides/accessibility/

# context7 (regenerated separately via MCP)
# /clauderic/dnd-kit  → reference.md
EOF

echo "${SNAPSHOT_DATE}" > "${DEST}/_snapshot_date.txt"

echo "done: ${DEST}"
