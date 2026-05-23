---
name: ts-edit-reminder
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^(workers|app)/.+\.(ts|tsx|mts|cts)$
---

**TypeScript file in `workers/` or `app/` modified.**

Run `bash scripts/agent-check.sh` before claiming done.

Catches the Phase 1.5 hallucination class: wrong import subpath, missing named export, type mismatch. Only `tsc -b` reliably catches these — grep-based and vibes-only audits do not.
