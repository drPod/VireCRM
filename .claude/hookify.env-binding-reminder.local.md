---
name: env-binding-reminder
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^workers/.+\.ts$
  - field: new_text
    operator: contains
    pattern: c.env.
---

**`c.env.X` reference added in Worker code.**

Verify the binding exists in `wrangler.jsonc`, then run `bash scripts/check-worker-config.sh`.

Catches the failure mode where a fresh binding name is invented in code but never wired into `wrangler.jsonc` — it'll typecheck against `c.env` (if `wrangler types` hasn't been regenerated) but blow up at runtime as `undefined`.
