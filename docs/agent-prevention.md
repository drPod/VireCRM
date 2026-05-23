# Agent prevention scaffold

Verification gates that stop agents from shipping hallucinated imports, schema drift, or config drift. Every script under `scripts/` listed here exits non-zero on failure so agents (and CI, eventually) can treat the signal as enforced rather than advisory.

## Why this exists

A recent audit caught a hallucinated subpath import — `@supabase/server/core` for type symbols that actually live at top-level `@supabase/server`. Three subagents auditing the diff in parallel all reported "imports clean" without catching it, and the original author declared the change done without running `tsc`. Three failure modes contributed:

1. **Mirror gap.** `docs/<lib>/` holds vendor product docs (guides, llms-full.txt scrapes), not the npm package's `.d.ts` files. An agent reading the mirror cannot tell which subpath exports a given symbol — that information only exists in the installed package under `node_modules/<pkg>/dist/`.
2. **No typecheck gate.** The global rule "verify before claiming done" was advisory. Nothing in the loop forced `tsc` to run before the agent reported success, so the broken import shipped.
3. **Vibes-only audits.** Audit subagents read the diff and reasoned about it. None actually executed `tsc` or grepped a type-definition source of truth, so all three confidently confirmed code that did not compile.

The five scripts below close those gaps. Each is small, scriptable, and produces a one-line PASS/FAIL summary an agent can grep.

## The 5 verification scripts

- `scripts/sync-npm-types.sh` — refresh `docs/_npm-types/<pkg>/` from `node_modules/<pkg>/` so agents have a real source of truth for type symbols and subpath exports (Unit 1).
- `scripts/agent-check.sh` — typecheck gate. Wraps `bun run typecheck` (`wrangler types && react-router typegen && tsc -b`) with the heap bump tsc needs on this repo and prints `agent-check: PASS` / `agent-check: FAIL (exit N)` (this file).
- `scripts/check-schema-drift.sh` — diff Drizzle schema TS against the latest committed migration; fail when they disagree (Unit 3).
- `scripts/check-worker-config.sh` — verify every `c.env.X` reference in worker code resolves to a binding declared in `wrangler.jsonc` (Unit 4).
- `scripts/check-build.sh` — smoke test the full Vite + Tailwind + React Router build so config or component edits cannot silently break the bundle (Unit 5).

## When to run each

| Trigger | Script |
|---|---|
| Any multi-file TypeScript write, or before declaring TS work "done" | `agent-check.sh` |
| Edit under `workers/db/schema/` or new Drizzle migration | `check-schema-drift.sh` |
| `wrangler.jsonc` edit OR new `c.env.X` reference added in worker code | `check-worker-config.sh` |
| Vite / Tailwind / React Router config or route component edit | `check-build.sh` |
| `bun install` ran, or new package added to `package.json` | `sync-npm-types.sh` |

Multiple triggers can fire on one change — run every script the change matches before claiming done. `agent-check.sh` is the cheapest signal and should be the default first run after any TS edit.

## For audit subagents

If you are reviewing a diff and about to report "imports clean," "compiles fine," or any equivalent claim, the report is only valid when both of the following are true:

1. You ran `bash scripts/agent-check.sh` against the current working tree and observed `agent-check: PASS` in the output.
2. For every named import in the diff (e.g. `import { Foo } from "@some/pkg/subpath"`), you grepped `docs/_npm-types/<pkg>/` and confirmed both the subpath and the symbol exist in the package's type definitions.

Reading the diff and reasoning about it is not sufficient. Vibes audits caused the original bug. Run the scripts, paste a short excerpt of the output, then report.
