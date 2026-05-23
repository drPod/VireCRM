# Agent prevention scaffold

Static contracts (types, schema/migration consistency, declared bindings, buildability) are **enforced**, not advised. Three layers, each unbypassable from the layer above. If the gates pass, you have the contracts. They do not catch runtime/behavioral hallucinations — see the bottom of this file.

## Enforcement layers

| Layer | Where | Triggers | Bypasses |
|---|---|---|---|
| 1. Claude Code Stop hook | `.claude/settings.json` → `scripts/hook-stop-typecheck.sh` → `scripts/check-all.sh` | Every time a Claude Code agent tries to stop | Only by editing the settings file |
| 2. Git pre-commit hook | `.githooks/pre-commit` (wired by `prepare` → `git config core.hooksPath .githooks`) | Every `git commit` from any agent (Claude / Cursor / Aider / Copilot) or human | `git commit --no-verify` (visible in shell history) |
| 3. CI workflow | `.github/workflows/checks.yml` | Every push to `main`, every PR | Branch protection rules (none today; recommend enabling) |

`scripts/check-all.sh` is the universal entry point — inspects `git diff` (staged + unstaged + untracked) and dispatches only the gates whose triggers match. Run it manually anytime; Layer 1 calls it on every stop.

Hookify rules in `.claude/hookify.*.local.md` still fire as soft reminders after matching file edits, but they're now redundant scaffolding — Layer 1 catches whatever you ignored.

## What each layer runs

| Gate | Layer 1 (Stop) | Layer 2 (pre-commit) | Layer 3 (CI) |
|---|:-:|:-:|:-:|
| `scripts/agent-check.sh` (typecheck) | ✓ | ✓ | ✓ |
| `scripts/check-schema-drift.sh` | — | ✓ (if `workers/db/schema/` or `drizzle/` staged) | ✓ |
| `scripts/check-worker-config.sh` | — | ✓ (if `wrangler.jsonc` or `workers/**.ts` staged) | ✓ |
| `scripts/check-build.sh` | — | — (~30s, intolerable per commit) | ✓ |
| `scripts/sync-npm-types.sh` | — | — (runs via `postinstall` on `bun install`) | runs via `bun install` |

Each script prints a final `PASS` / `FAIL` line and exits with the underlying tool's code. Layer 1 maps non-zero → exit 2 → Claude Code blocks the stop attempt.

## The Phase 1.5 incident (why this exists)

An agent imported type symbols from `@supabase/server/core`, a subpath that doesn't exist. Three things failed together:

1. The author never ran `tsc`.
2. Three audit subagents reviewing the diff in parallel all reported "imports clean." None executed `tsc`; none grepped `.d.ts` files.
3. The vendor doc mirror at `docs/<lib>/` is product documentation, not the npm package's type definitions. No agent-accessible ground truth existed for what the package actually exports.

The maintainer caught it by chance during manual review. The realistic assumption is that more of the same class slipped through unnoticed.

Layer 1 forecloses the first failure mode (you cannot stop with a broken tsc). Layer 2 forecloses the second (commits with broken types never enter history). Layer 3 forecloses the third on shared branches. `scripts/sync-npm-types.sh` keeps `docs/_npm-types/` as the agent-grep-able ground truth that didn't exist when Phase 1.5 happened.

## Hallucination classes — what's caught, what isn't

Caught by Layer 1+:

- Wrong import subpath (Phase 1.5).
- Wrong named export.
- Wrong type signature / arg shape.
- Schema TS edited without `bun run db:generate`.
- `c.env.X` reference with no binding in `wrangler.jsonc`.
- Vite / Tailwind / React Router build-pipeline regression (Layer 3 only — pre-commit skips for speed).
- Stale `.d.ts` mirror.

**Not caught** — these need runtime evidence, not static analysis:

- Wrong API behavior at runtime. Types match, function exists, returns wrong thing.
- Wrong SQL logic. Migration valid, query semantics wrong.
- Hallucinated CLI flag (e.g. `wrangler deploy --does-not-exist`).
- Wrong webhook payload shape. Code parses field vendor never sends.
- Hallucinated env var name (Layer caches CF bindings only).
- Wrong UI behavior. Builds clean, renders wrong.

For the uncaught classes, in order of cost:

1. Run the code. Hit endpoints, query DB through `psql`, send the webhook locally.
2. Cross-reference vendor truth in `docs/<lib>/`. Mirrors are version-pinned; they won't lie about syntax but can lag on semantics.
3. Replay a real payload.
4. Pin the truth in a test. Next agent will hit the same surface.

## Audit subagent contract

If a subagent is asked to review a diff and considers reporting "imports clean," "compiles fine," or anything equivalent: the report is valid only when both are true:

1. Ran `bash scripts/agent-check.sh` and observed `agent-check: PASS`.
2. For every named import in the diff, grepped `docs/_npm-types/<pkg>/` and confirmed the subpath and the symbol exist.

Reading the diff and reasoning about it is not sufficient. Three parallel vibes audits missed Phase 1.5.

## Adding a new gate

The 3-gate count is not load-bearing. When a recurring hallucination class shows up:

1. Write a `scripts/check-<class>.sh` that exits non-zero on violation and prints a final PASS/FAIL line.
2. Add it to the appropriate enforcement layer(s) in the table above (start with CI; promote to pre-commit if cheap; promote to Stop only if very cheap).
3. Update the **Hallucination classes** table here.

The gates are not finished. They're the part of the unknown surface mapped so far.
