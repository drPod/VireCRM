#!/usr/bin/env bash
# Secret-scan gate. Runs gitleaks across the working tree. CI installs the
# binary via gitleaks/gitleaks-action@v2 in .github/workflows/gitleaks.yml.
#
# Locally, contributors may not have the gitleaks binary. We skip silently
# in that case — the CI workflow is the enforced gate. To install:
#   macOS:  brew install gitleaks
#   linux:  see https://github.com/gitleaks/gitleaks/releases
#
# Repo handles Supabase service role, Stripe sk_live, MS Graph client secret
# (see CLAUDE.md "Secrets locations"). A leak in git history would be high
# severity — keep this gate blocking in CI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "check-gitleaks: SKIP (gitleaks not installed locally — CI will catch)"
  exit 0
fi

echo "check-gitleaks: scanning working tree"
gitleaks detect --source=. --no-banner --redact --exit-code 1
echo "check-gitleaks: PASS"
