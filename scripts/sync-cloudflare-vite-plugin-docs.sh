#!/usr/bin/env bash
#
# Refresh the local mirror of @cloudflare/vite-plugin docs.
# Source: https://developers.cloudflare.com/workers/vite-plugin/
#
# Output: docs/cloudflare-vite-plugin/
#   - llms-vite-plugin.md      slice of CF llms-full.txt (all vite-plugin pages, concat)
#   - <page>.md                per-page markdown (fetched via .../index.md endpoint)
#   - _urls.txt                provenance: every URL pulled
#   - _snapshot_date.txt       UTC date of the last successful sync
#
# Idempotent: re-running overwrites outputs in place.
#
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
out_dir="${repo_root}/docs/cloudflare-vite-plugin"
mkdir -p "$out_dir"

llms_full_url="https://developers.cloudflare.com/llms-full.txt"
slice_out="${out_dir}/llms-vite-plugin.md"
urls_out="${out_dir}/_urls.txt"
date_out="${out_dir}/_snapshot_date.txt"

# Per-page paths (under https://developers.cloudflare.com/) — order matches docs nav.
pages=(
  "workers/vite-plugin"
  "workers/vite-plugin/get-started"
  "workers/vite-plugin/tutorial"
  "workers/vite-plugin/reference/api"
  "workers/vite-plugin/reference/static-assets"
  "workers/vite-plugin/reference/cloudflare-environments"
  "workers/vite-plugin/reference/vite-environments"
  "workers/vite-plugin/reference/debugging"
  "workers/vite-plugin/reference/migrating-from-wrangler-dev"
  "workers/vite-plugin/reference/non-javascript-modules"
  "workers/vite-plugin/reference/programmatic-configuration"
  "workers/vite-plugin/reference/secrets"
)

snapshot_date="$(date -u +%Y-%m-%d)"

# _urls.txt is rewritten each run so it reflects only this snapshot.
: > "$urls_out"

echo "==> slicing ${llms_full_url} → ${slice_out}"
# Stream the 47MB llms-full.txt through awk and emit only the page-records whose
# breadcrumb mentions /workers/vite-plugin/. The full file is never written to disk.
# Upstream delimits each "page" with `\n---\n\n---\n`; we split on that as RS,
# match the embedded BreadcrumbList JSON, and re-emit the original delimiters.
curl -fsSL "$llms_full_url" \
  | awk 'BEGIN { RS="\n---\n\n---\n"; ORS="" }
         /BreadcrumbList[^|]*\/workers\/vite-plugin\//{
           print "---\n" $0 "\n---\n\n"
         }' \
  > "$slice_out"
echo "$llms_full_url" >> "$urls_out"

slice_bytes="$(wc -c < "$slice_out" | tr -d ' ')"
echo "==> slice size: ${slice_bytes} bytes"

if [ "$slice_bytes" -lt 2048 ]; then
  echo "WARN: slice under 2KB — upstream format may have shifted; per-page scrapes still proceed." >&2
  echo "# fallback: slice <2KB on ${snapshot_date}; per-page scrapes only" >> "$urls_out"
fi

# Flatten upstream path into a local filename:
#   workers/vite-plugin               → index.md  (landing page)
#   workers/vite-plugin/get-started   → get-started.md
#   workers/vite-plugin/reference/api → reference-api.md
page_filename() {
  local rel="${1#workers/vite-plugin}"
  rel="${rel#/}"
  echo "${rel:-index}.md" | tr '/' '-'
}

# Fetch one page. Called in parallel and joined via `wait` so a failed curl
# (under set -e) aborts the script with the same exit status.
fetch_page() {
  local url="$1" dest="$2"
  echo "    ${url} → $(basename "$dest")"
  curl -fsSL "$url" -o "$dest"
  echo "$url" >> "$urls_out"
}

echo "==> fetching ${#pages[@]} per-page markdown files in parallel"
pids=()
for path in "${pages[@]}"; do
  url="https://developers.cloudflare.com/${path}/index.md"
  dest="${out_dir}/$(page_filename "$path")"
  fetch_page "$url" "$dest" &
  pids+=($!)
done
for pid in "${pids[@]}"; do
  wait "$pid"
done

echo "$snapshot_date" > "$date_out"
echo "==> snapshot date: $snapshot_date"
echo "==> done: $(ls "$out_dir" | wc -l | tr -d ' ') files in ${out_dir}"
