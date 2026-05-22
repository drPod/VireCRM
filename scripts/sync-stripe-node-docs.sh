#!/usr/bin/env bash
# Sync the stripe-node vendor doc mirror in docs/stripe-node/.
#
# Idempotent: re-running overwrites the .md / .txt files with fresh upstream content.
# Snapshot date in docs/stripe-node/_snapshot_date.txt is bumped to today.
#
# NOTE: the context7 portion (docs/stripe-node/reference.md) must be regenerated
# via the Claude Code MCP — no public CLI equivalent exists for context7's
# library query endpoint. To refresh reference.md:
#   1. Open Claude Code in this repo.
#   2. Invoke mcp__context7__query-docs with:
#        libraryId = /stripe/stripe-node
#        query     = "webhook signature verification cloudflare workers
#                     fetch http client async constructEvent
#                     createSubtleCryptoProvider"
#   3. Overwrite docs/stripe-node/reference.md with the returned snippets.
# TODO(sync-stripe-node-docs): wire up an automated context7 fetch once Stripe
# (or context7) ships a stable CLI / HTTP endpoint we can curl here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIRROR_DIR="${REPO_ROOT}/docs/stripe-node"

mkdir -p "${MIRROR_DIR}"

fetch() {
  local url="$1"
  local out="${MIRROR_DIR}/$2"
  echo "GET ${url} -> ${out}"
  curl -fsSL -o "${out}" "${url}"
}

# Stripe docs index (used as a fat grep target for capability discovery).
fetch "https://docs.stripe.com/llms.txt"                                "llms.txt"

# Canonical Stripe doc pages, .md flavor (Stripe ships a verbatim LLM mirror).
fetch "https://docs.stripe.com/sdks.md"                                 "sdks-node.md"
fetch "https://docs.stripe.com/get-started/development-environment.md"  "development-environment.md"
fetch "https://docs.stripe.com/webhooks/signatures.md"                  "webhooks-signatures.md"
fetch "https://docs.stripe.com/payments/checkout.md"                    "payments-checkout.md"
fetch "https://docs.stripe.com/tax.md"                                  "tax.md"

# Stamp the snapshot date.
date -u +%Y-%m-%d > "${MIRROR_DIR}/_snapshot_date.txt"

echo "stripe-node docs mirror synced into ${MIRROR_DIR}"
echo "snapshot date: $(cat "${MIRROR_DIR}/_snapshot_date.txt")"
echo "remember to refresh reference.md via context7 (see header comment)."
