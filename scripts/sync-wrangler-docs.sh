#!/usr/bin/env bash
# Sync Wrangler (Cloudflare Workers CLI + config) docs into docs/wrangler/.
#
# Idempotent. Re-running overwrites every output file with fresh upstream
# content. Streams the 47 MB Cloudflare `llms-full.txt` through a slicer so
# the full file never lands on disk.
#
# Usage: bash scripts/sync-wrangler-docs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/docs/wrangler"
SNAPSHOT_DATE="2026-05-22"

LLMS_FULL_URL="https://developers.cloudflare.com/llms-full.txt"
SLICE_OUT="$OUT_DIR/llms-wrangler.md"

# Canonical sub-pages: scope path → output filename.
SUBPAGES=(
  "workers/wrangler/commands/|wrangler-commands.md"
  "workers/wrangler/configuration/|wrangler-configuration.md"
  "workers/wrangler/system-environment-variables/|wrangler-system-environment-variables.md"
  "workers/configuration/secrets/|workers-configuration-secrets.md"
  "workers/configuration/routing/|workers-configuration-routing.md"
  "workers/configuration/compatibility-dates/|workers-configuration-compatibility-dates.md"
)

mkdir -p "$OUT_DIR"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "error: missing dependency: $1" >&2; exit 1; }
}
need curl
need python3

# --- 1. Slice the 47 MB llms-full.txt down to wrangler + configuration pages.
#
# Pages are separated by `---\n\n---\ntitle:` (frontmatter open after a blank
# line). Each page ends with a `BreadcrumbList` JSON block that names the
# canonical path. Keep a page whose breadcrumb URL falls under
# /workers/wrangler/ or /workers/configuration/.
#
# Python is inlined via `python3 -c` instead of a heredoc because a heredoc
# would consume stdin and starve the upstream curl pipe.
SLICER_PY='
import sys

out_path = sys.argv[1]
KEEP = ("/workers/wrangler/", "/workers/configuration/")
cur, keep = [], False

with open(out_path, "w", encoding="utf-8") as out:
    def flush():
        global cur, keep
        if keep and cur:
            out.writelines(cur)
        cur, keep = [], False

    for line in sys.stdin:
        if (len(cur) >= 3
                and cur[-3] == "---\n"
                and cur[-2] == "\n"
                and cur[-1] == "---\n"
                and line.startswith("title:")):
            page_open = cur[-3:]
            cur = cur[:-3]
            flush()
            cur.extend(page_open)
            cur.append(line)
            continue
        cur.append(line)
        if "BreadcrumbList" in line and any(p in line for p in KEEP):
            keep = True
    flush()
'

echo "[sync-wrangler-docs] slicing $LLMS_FULL_URL -> $SLICE_OUT"
curl -fsSL "$LLMS_FULL_URL" | python3 -c "$SLICER_PY" "$SLICE_OUT"

slice_bytes=$(wc -c <"$SLICE_OUT" | tr -d ' ')
if [ "$slice_bytes" -lt 100000 ]; then
  echo "error: slice unexpectedly small ($slice_bytes bytes); upstream layout may have changed" >&2
  exit 1
fi
echo "[sync-wrangler-docs] slice ok: ${slice_bytes} bytes"

# --- 2. Fetch canonical sub-pages as markdown.
{
  echo "# llms-wrangler.md slice source"
  echo "$LLMS_FULL_URL"
  echo ""
  echo "# Canonical sub-pages (developers.cloudflare.com/<path>/index.md)"
} > "$OUT_DIR/_urls.txt"

for entry in "${SUBPAGES[@]}"; do
  path="${entry%%|*}"
  fname="${entry##*|}"
  url="https://developers.cloudflare.com/${path}index.md"
  page_url="https://developers.cloudflare.com/${path}"
  echo "[sync-wrangler-docs] fetching $url"
  curl -fsSL "$url" -o "$OUT_DIR/$fname"
  echo "$page_url -> $fname" >> "$OUT_DIR/_urls.txt"
done

# --- 3. Snapshot date.
echo "$SNAPSHOT_DATE" > "$OUT_DIR/_snapshot_date.txt"

echo "[sync-wrangler-docs] done. snapshot=$SNAPSHOT_DATE"
echo "[sync-wrangler-docs] files:"
ls -la "$OUT_DIR"
