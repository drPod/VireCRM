---
name: bun-install-reminder
enabled: true
event: bash
action: warn
conditions:
  - field: command
    operator: regex_match
    pattern: bun\s+(add|install|i)\b
---

**Dependency change just ran.**

Run `bash scripts/sync-npm-types.sh` to refresh `docs/_npm-types/`.

The `postinstall` hook *should* auto-run this, but verify the mirror was updated — fresh `.d.ts` is the only ground-truth source for named-export grep checks, and stale types are the root cause of the Phase 1.5 hallucination class.
