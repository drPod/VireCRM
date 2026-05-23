# Agent prevention scaffold

> **⚠ Agent-authored.** Drafted by AI agents from conversation context + incident postmortem. Verify load-bearing claims before relying on them.

## Why this scaffold exists

During the Phase 1.5 auth-gate work, an agent shipped a `@supabase/server/core` subpath import for three type symbols (`JWTClaims`, `UserClaims`, `AuthMode`) that actually live at the package root. The hallucinated import passed visual inspection from the author and three parallel audit subagents. Only `tsc -b` caught it — and the agent had declared the work "done" without ever running typecheck. CLAUDE.md said to verify before claiming done, but advice without enforcement is just advice.

## The 3 failure modes

1. **Mirror gap.** `docs/<lib>/` mirrors product docs (usage, concepts) but not npm package `.d.ts` files. Grepping `docs/supabase/` for `JWTClaims` returned zero hits — the symbol lives in `node_modules/@supabase/server/dist/types-*.d.mts`. Agents grep the mirror, find nothing, conclude "checked docs, looks fine."
2. **No typecheck gate.** "Verify before claiming done" was advisory. No script, no hook, no automation forced the agent to actually run `bun run typecheck` before declaring complete.
3. **Vibes audits.** Audit subagents reported "imports clean" without `cat`ing any `.d.ts` file, without running `tsc -b`. "Package is in `package.json`" got conflated with "this named symbol is exported from that subpath."

## The 5 scripts

These five entrypoints close the three gaps above. They are payload — the [hookify rules](../.claude/) and the [Stop hook in `.claude/settings.json`](../.claude/settings.json) are what trigger them.

| Script | When to run | What it does |
|---|---|---|
| `scripts/sync-npm-types.sh` | After `bun install` (auto-runs via `postinstall`) | Mirrors every load-bearing npm package's `.d.ts` files into `docs/_npm-types/<pkg>/` so agents can grep for named exports against ground truth. |
| `scripts/agent-check.sh` | After any multi-file TS write | Runs `bun run typecheck` (`wrangler types && react-router typegen && tsc -b`) with `NODE_OPTIONS=--max-old-space-size=6144`. Exits with tsc's exit code. |
| `scripts/check-schema-drift.sh` | After editing `workers/db/schema/*.ts` | Runs `drizzle-kit check` plus a pending-diff probe to catch schema TS edits that haven't been `db:generate`d into migration files. |
| `scripts/check-worker-config.sh` | After editing `wrangler.jsonc` or adding a `c.env.X` reference | Validates wrangler config syntax and binding references (via `wrangler deploy --dry-run` or generated-types typecheck fallback). |
| `scripts/check-build.sh` | After editing Vite / Tailwind / route config | Runs `bun run build` end-to-end as a smoke test. Catches Tailwind v4 directive errors, vite plugin failures, route config drift. |

## Enforcement layers

The scripts are useless if no one runs them — which is exactly what happened during the Phase 1.5 incident. Three layers stack on top of the scripts to make sure they actually fire:

- **Layer 1 — scripts themselves.** Hand-runnable, no assumptions about who invokes them.
- **Layer 2 — hookify rules at `.claude/hookify.*.local.md`** (Unit 7). Pattern-matched warnings injected into the agent's next turn after edits touch hallucination-prone surfaces. Action is `warn`, not `block` — these tell the agent which script to run and why, but can't execute scripts themselves.
- **Layer 3 — native Stop hook in `.claude/settings.json`** (Unit 8). Real `Stop` hook executes `bash scripts/agent-check.sh` on every turn-end. On failure it emits `{"decision": "block", "reason": "..."}` so the agent can't declare done with a broken typecheck. This is the only layer that can actually run a check and block on its exit code; the hookify nudges catch the same issues earlier, before the Stop hook even fires.
