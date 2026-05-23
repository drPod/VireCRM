---
name: wrangler-config-reminder
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: wrangler\.jsonc$
---

**Wrangler config edited.**

Run `bash scripts/check-worker-config.sh` before claiming done.

Catches binding typos, missing bindings referenced in code, and other `wrangler.jsonc` drift that only surfaces at deploy time. Cheaper to catch locally than at the CF edge.
