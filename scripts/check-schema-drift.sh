#!/usr/bin/env bash
# Detect drift between Drizzle schema TS (workers/db/schema/*.ts) and
# committed migrations under drizzle/. Catches the failure mode where an
# agent edits the schema but forgets to run `bun run db:generate`.
#
# Two checks:
#   1. `drizzle-kit check` — validates the existing migration chain hashes.
#   2. Dry-run `drizzle-kit generate` into a temp folder seeded with the
#      committed migrations, then diff against the committed drizzle/.
#      Any diff = schema TS contains changes not yet baked into a migration.
#
# Read-only with respect to the repo: never writes into drizzle/ or schema TS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# drizzle-kit 0.31.x rejects `--config` mixed with other CLI flags and
# resolves relative paths against the config file's directory, so the temp
# config + temp out dir both have to live inside the repo root.
TMP_DIR="${REPO_ROOT}/.drizzle-drift-check-tmp"
TMP_CONFIG="${REPO_ROOT}/.drizzle-drift-check.config.ts"

cleanup() {
  rm -rf "${TMP_DIR}" "${TMP_CONFIG}"
}
trap cleanup EXIT

fail() {
  echo "check-schema-drift: FAIL ($1)" >&2
  exit "${2:-1}"
}

# Step 1: migration chain integrity.
if ! bunx drizzle-kit check >/tmp/drizzle-drift-check.log 2>&1; then
  rc=$?
  cat /tmp/drizzle-drift-check.log >&2
  fail "drizzle-kit check failed" "${rc}"
fi

# Step 2: dry-run generate against a copy of the committed migrations.
rm -rf "${TMP_DIR}"
mkdir -p "${TMP_DIR}"
cp -R drizzle "${TMP_DIR}/drizzle"

cat > "${TMP_CONFIG}" <<EOF
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./workers/db/schema/*.ts",
  out: "./.drizzle-drift-check-tmp/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
  breakpoints: true,
});
EOF

# Run generate non-interactively. DATABASE_URL stays empty — generate is a
# pure schema-diff against the snapshot files, no DB connection needed.
if ! DATABASE_URL="" bunx drizzle-kit generate --config="${TMP_CONFIG}" \
      >/tmp/drizzle-drift-generate.log 2>&1; then
  rc=$?
  cat /tmp/drizzle-drift-generate.log >&2
  fail "drizzle-kit generate (dry-run) failed" "${rc}"
fi

# Compare against the committed drizzle/. Any difference = pending migration.
if ! git diff --no-index --quiet drizzle/ "${TMP_DIR}/drizzle/"; then
  echo >&2
  echo "Schema TS has changes not present in drizzle/. Diff vs would-be-generated:" >&2
  git --no-pager diff --no-index --stat drizzle/ "${TMP_DIR}/drizzle/" >&2 || true
  fail "pending migration — run 'bun run db:generate' and commit the new files"
fi

echo "check-schema-drift: PASS"
