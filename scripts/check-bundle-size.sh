#!/usr/bin/env bash
# Hard-fail when the Worker bundle creeps toward the Cloudflare size ceiling.
#
# CF Workers caps deployed bundles at 10 MiB compressed (paid) / 3 MiB (free).
# Gate at 8 MiB to leave PR-sized headroom before a deploy-blocking surprise.
#
# `react-router build` must run first because the framework-mode entry resolves
# through `virtual:react-router/server-build` (same constraint as
# scripts/check-worker-config.sh Path A). `du -sk` on the outdir measures
# uncompressed bundled output — a proxy for the compressed wire size CF
# enforces, but tracks growth tightly enough to catch a runaway dep early.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

LIMIT_KB=$((8 * 1024))
OUTDIR=".wrangler/size-check"

cleanup() {
  rm -rf "${OUTDIR}" build
}
trap cleanup EXIT

set +e
bun run build >/tmp/check-bundle-size-build.log 2>&1
build_rc=$?
set -e
if [ "${build_rc}" -ne 0 ]; then
  cat /tmp/check-bundle-size-build.log >&2
  echo "check-bundle-size: FAIL (react-router build failed)" >&2
  exit "${build_rc}"
fi

rm -rf "${OUTDIR}"
set +e
bunx wrangler deploy --dry-run --outdir="${OUTDIR}" >/tmp/check-bundle-size-wrangler.log 2>&1
wrangler_rc=$?
set -e
if [ "${wrangler_rc}" -ne 0 ]; then
  cat /tmp/check-bundle-size-wrangler.log >&2
  echo "check-bundle-size: FAIL (wrangler dry-run failed)" >&2
  exit "${wrangler_rc}"
fi

SIZE_KB=$(du -sk "${OUTDIR}" | awk '{print $1}')
SIZE_MIB=$(awk "BEGIN {printf \"%.2f\", ${SIZE_KB} / 1024}")

echo "Worker bundle size: ${SIZE_MIB} MiB (${SIZE_KB} KiB) — limit 8 MiB (${LIMIT_KB} KiB)"

if [ "${SIZE_KB}" -gt "${LIMIT_KB}" ]; then
  echo "check-bundle-size: FAIL (bundle exceeds 8 MiB)" >&2
  exit 1
fi

echo "check-bundle-size: PASS"
