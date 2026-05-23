---
name: schema-drift-reminder
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^workers/db/schema/.+\.ts$
---

**Drizzle schema file edited.**

Run `bash scripts/check-schema-drift.sh` before claiming done.

Catches the failure mode where a column is added or renamed in `workers/db/schema/*.ts` but `bun run db:generate` is never run, so the migration in `drizzle/` drifts from the TS source. Static typecheck won't catch this — only the schema-drift check will.
