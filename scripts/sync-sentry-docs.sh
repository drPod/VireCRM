#!/usr/bin/env bash
# Re-mirror Sentry docs (Cloudflare guide + React Router guide + Vite sourcemaps + DSN concept).
#
# Idempotent: re-runs overwrite docs/sentry/* cleanly.
# Snapshot date lives in docs/sentry/_snapshot_date.txt — refreshed each run.
#
# Endpoint convention: Sentry's docs (Mintlify-style) serve raw markdown when the page URL
# has its trailing slash dropped and `.md` appended. E.g.
#   https://docs.sentry.io/platforms/javascript/guides/cloudflare/  (HTML)
# → https://docs.sentry.io/platforms/javascript/guides/cloudflare.md (markdown)
# `?format=md` also works but the `.md` suffix is the form Sentry's own internal links use.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/docs/sentry"
mkdir -p "$OUT"

# Output filename | upstream URL (HTML page; sync script appends .md to fetch raw markdown).
declare -a PAGES=(
  "cloudflare|https://docs.sentry.io/platforms/javascript/guides/cloudflare/"
  "cloudflare-frameworks|https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/"
  "cloudflare-releases|https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/releases/"
  "react-router|https://docs.sentry.io/platforms/javascript/guides/react-router/"
  "react-router-manual-setup|https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup/"
  "sourcemaps-vite|https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/"
  "sourcemaps-troubleshooting|https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/"
  "dsn-explainer|https://docs.sentry.io/concepts/key-terms/dsn-explainer/"
)

SNAPSHOT_DATE="$(date -u +%Y-%m-%d)"
{
  echo "# Sentry docs mirror — pulled $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Source: https://docs.sentry.io/ (Mintlify; markdown via URL.md suffix)"
  echo ""
} > "$OUT/_urls.txt"

for entry in "${PAGES[@]}"; do
  name="${entry%%|*}"
  html_url="${entry##*|}"
  md_url="${html_url%/}.md"
  out_file="$OUT/$name.md"
  echo "Fetching $name <- $md_url"
  if curl -fsSL "$md_url" -o "$out_file"; then
    echo "$md_url" >> "$OUT/_urls.txt"
  else
    echo "# 404 — dropped: $md_url" >> "$OUT/_urls.txt"
    rm -f "$out_file"
  fi
done

echo "$SNAPSHOT_DATE" > "$OUT/_snapshot_date.txt"

echo ""
echo "Mirrored Sentry docs to $OUT"
echo "Snapshot date: $SNAPSHOT_DATE"
echo "File count: $(ls -1 "$OUT" | wc -l | tr -d ' ')"
echo "Total size: $(du -sh "$OUT" | awk '{print $1}')"
