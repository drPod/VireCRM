# Cloudflare Runtime Context Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom Cloudflare Worker entry for this TanStack Start app that exposes `(env, ctx, cf)` to route handlers via an `AsyncLocalStorage`-backed `getCloudflareContext()` accessor, so route handlers can call `ctx.waitUntil(promise)` for fire-and-forget work. Apply it to `src/routes/api/public/contact.ts:304` to fix the prod AI-classification regression (ISSUES.md item-1).

**Architecture:** A new `src/server.ts` wraps the stock `@tanstack/react-start/server-entry` handler. Per-request, it captures `{ env, ctx, cf }` into an `AsyncLocalStorage` frame, then delegates to TanStack Start's handler. Route handlers read the frame via `getCloudflareContext()`. A `keepAlive(promise)` helper wraps the common case (`ctx.waitUntil(promise)` on workerd, `await promise` on Node fallback).

**Tech Stack:** TanStack Start v1.167+, `@cloudflare/vite-plugin` v1.25.5, `@cloudflare/workers-types` (new devDep), bun 1.2+, AsyncLocalStorage from `node:async_hooks` (CF workerd `nodejs_compat` flag — already enabled in `wrangler.jsonc`).

**Spec:** `docs/superpowers/specs/2026-05-17-cloudflare-context-scaffold-design.md`

**Verification model:** No unit-test harness exists in this repo (spec non-goal #1). Verification is `bun run typecheck` + manual integration test via `curl` + `psql` query against the live DB row. The plan documents the exact curl + psql commands at each gate.

---

## Task 1: Install `@cloudflare/workers-types` as devDep

**Files:**
- Modify: `package.json` (devDependencies entry)
- Modify: `bun.lock`

- [ ] **Step 1: Confirm not already installed**

Run: `find node_modules -maxdepth 4 -type d -name "workers-types" 2>/dev/null`
Expected: empty output (verified during spec-writing; sanity-check before install).

- [ ] **Step 2: Install**

Run: `bun add -d @cloudflare/workers-types`
Expected: `installed @cloudflare/workers-types@<version>` + `bun.lock` updated.

- [ ] **Step 3: Verify install**

Run: `ls node_modules/@cloudflare/workers-types/index.d.ts`
Expected: file exists.

- [ ] **Step 4: NO COMMIT YET.** Bundled with Task 6 commit.

---

## Task 2: Create typed `CloudflareEnv` interface

**Files:**
- Create: `src/types/cloudflare-env.d.ts`

- [ ] **Step 1: Create file with this exact content**

```ts
/// <reference types="@cloudflare/workers-types" />

/**
 * Shape of the `env` object passed to the Cloudflare Worker's
 * `fetch(request, env, ctx)` handler. Mirrors the union of:
 *   - `vars` block in wrangler.jsonc (public, non-secret)
 *   - secrets set via `wrangler secret put`
 *   - bindings (KV, D1, R2, etc.) declared in wrangler.jsonc
 *
 * Keep in sync when adding new vars/secrets/bindings. New env vars without
 * an entry here will read as `string | undefined` (still functional, just
 * no TS narrowing).
 *
 * Initial inventory: env-audit subagent run 2026-05-17, see
 * docs/superpowers/specs/2026-05-17-cloudflare-context-scaffold-design.md.
 */
declare global {
  interface CloudflareEnv {
    // Wrangler vars block (public, non-secret)
    SUPABASE_URL: string;
    SUPABASE_PUBLISHABLE_KEY: string;

    // Required secrets (wrangler secret put)
    SUPABASE_SERVICE_ROLE_KEY: string;
    ANTHROPIC_API_KEY: string;
    RESEND_API_KEY: string;
    CRON_SECRET: string;

    // Optional / feature-flagged secrets
    PLATFORM_APOLLO_API_KEY?: string;
    CONTACT_TEST_MODE?: string;
    CONTACT_TEST_INBOX?: string;
    PUBLISHED_URL?: string;
    SITE_URL?: string;

    // Future bindings land here as: MY_KV: KVNamespace; DB: D1Database; etc.
  }
}

export {};
```

- [ ] **Step 2: NO COMMIT YET.**

---

## Task 3: Add `@cloudflare/workers-types` to tsconfig `types` array

**Files:**
- Modify: `tsconfig.json` (one line)

- [ ] **Step 1: Read current tsconfig.json**

The current `types` line is: `"types": ["vite/client"],`

- [ ] **Step 2: Edit to add workers-types**

Replace:
```jsonc
    "types": ["vite/client"],
```
with:
```jsonc
    "types": ["vite/client", "@cloudflare/workers-types"],
```

- [ ] **Step 3: NO COMMIT YET.**

---

## Task 4: Create `src/lib/cloudflare/context.ts` — ALS + accessors + `keepAlive`

**Files:**
- Create: `src/lib/cloudflare/context.ts`

- [ ] **Step 1: Create file with this exact content**

```ts
/**
 * Per-request Cloudflare runtime context.
 *
 * The stock TanStack Start server entry only passes `request` through to
 * route handlers — `env` and `ctx` from CF Workers' `fetch(request, env, ctx)`
 * are dropped. This module captures them in an AsyncLocalStorage frame so
 * route handlers can read them without each route having to re-plumb the
 * signature.
 *
 * Entry point that populates the frame: `src/server.ts`.
 * Consumer pattern: `const cf = getCloudflareContext(); if (cf) cf.ctx.waitUntil(...)`.
 *
 * Returns `undefined` when called outside a worker request (unit tests,
 * one-off scripts). `keepAlive` handles the fallback automatically.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface CloudflareRequestContext {
  env: CloudflareEnv;
  ctx: ExecutionContext;
  cf: IncomingRequestCfProperties | undefined;
}

const cloudflareContextStore = new AsyncLocalStorage<CloudflareRequestContext>();

/**
 * Populate the per-request CF context for the duration of `fn`.
 * Called once per incoming request from `src/server.ts`.
 */
export function runWithCloudflareContext<T>(
  value: CloudflareRequestContext,
  fn: () => T,
): T {
  return cloudflareContextStore.run(value, fn);
}

/**
 * Read the current request's CF context.
 * Returns `undefined` if called outside a request (tests, scripts).
 */
export function getCloudflareContext(): CloudflareRequestContext | undefined {
  return cloudflareContextStore.getStore();
}

/**
 * Fire-and-forget a promise so it survives past response close on Cloudflare
 * Workers. Falls back to await on non-worker runtimes (tests, scripts).
 *
 * The promise's own error handling is the caller's responsibility — `keepAlive`
 * swallows rejections on the Node fallback path so they don't become unhandled,
 * but it does NOT catch errors on the workerd path (rejections surface in
 * Workers logs, which is the desired behavior).
 */
export async function keepAlive<T>(promise: Promise<T>): Promise<void> {
  const cf = getCloudflareContext();
  if (cf) {
    cf.ctx.waitUntil(promise.then(() => undefined));
    return;
  }
  await promise.catch(() => undefined);
}
```

- [ ] **Step 2: NO COMMIT YET.**

---

## Task 5: Create custom `src/server.ts`

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Create file with this exact content**

```ts
/**
 * Custom Cloudflare Worker entry for this TanStack Start app.
 *
 * Replaces the stock `@tanstack/react-start/server-entry` default because the
 * stock entry only passes `request` through to route handlers — `env` and
 * `ctx` from CF Workers' `fetch(request, env, ctx)` get dropped. We wrap each
 * request in an AsyncLocalStorage frame so route handlers can access them via
 * `getCloudflareContext()` from `@/lib/cloudflare/context`.
 *
 * Wired up via `wrangler.jsonc`'s `main` field.
 *
 * See docs/superpowers/specs/2026-05-17-cloudflare-context-scaffold-design.md
 * for the design rationale.
 */
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { runWithCloudflareContext } from "@/lib/cloudflare/context";

export default createServerEntry({
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return runWithCloudflareContext(
      {
        env: env as CloudflareEnv,
        ctx,
        cf: (request as Request & { cf?: IncomingRequestCfProperties }).cf,
      },
      () => handler.fetch(request),
    );
  },
});
```

- [ ] **Step 2: NO COMMIT YET.**

---

## Task 6: Point `wrangler.jsonc` `main` at the new entry + typecheck + commit scaffold

**Files:**
- Modify: `wrangler.jsonc` (one line)

- [ ] **Step 1: Edit `wrangler.jsonc`**

Replace:
```jsonc
  "main": "@tanstack/react-start/server-entry",
```
with:
```jsonc
  "main": "./src/server.ts",
```

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: clean (`$ tsc --noEmit` exits 0, no errors).

If errors mention missing `ExecutionContext` or `IncomingRequestCfProperties` types, the tsconfig `types` array edit (Task 3) didn't land — check that `@cloudflare/workers-types` is in the array.

If errors mention `CloudflareEnv` missing keys, edit `src/types/cloudflare-env.d.ts` and add them — but don't expect this if Task 2 was applied as-written.

- [ ] **Step 3: Commit scaffold**

```bash
git add package.json bun.lock src/types/cloudflare-env.d.ts tsconfig.json src/lib/cloudflare/context.ts src/server.ts wrangler.jsonc
git commit -m "$(cat <<'EOF'
feat(cf): scaffold custom worker entry with per-request CF context

Stock @tanstack/react-start/server-entry only passes `request` through to
route handlers; CF Workers' `(env, ctx)` get dropped. This adds:

- src/server.ts — custom CF Worker entry that wraps the stock handler in
  an AsyncLocalStorage frame per request, capturing (env, ctx, cf).
- src/lib/cloudflare/context.ts — getCloudflareContext() accessor + a
  keepAlive(promise) helper for fire-and-forget work (uses ctx.waitUntil
  on workerd, falls back to await on Node).
- src/types/cloudflare-env.d.ts — typed CloudflareEnv interface, seeded
  from env-audit subagent (11 env vars enumerated).
- tsconfig.json — adds @cloudflare/workers-types to types array.
- package.json — adds @cloudflare/workers-types as devDep.
- wrangler.jsonc — flips main from stock entry to ./src/server.ts.

No call sites use the new accessor yet — that's a follow-on commit so
rollback is granular.

Spec: docs/superpowers/specs/2026-05-17-cloudflare-context-scaffold-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds. `git log -1 --stat` shows 6 files changed.

---

## Task 7: Verify local dev server still boots with custom entry

**Files:** (no edits)

The dev server might already be running (PID 66977 per session briefing). The `wrangler.jsonc` `main` change requires a restart because `@cloudflare/vite-plugin` reads `wrangler.jsonc` at vite startup.

- [ ] **Step 1: Restart dev server**

Run: `bash scripts/restart-dev.sh`
Expected: prints resolved `VITE_SUPABASE_URL`, starts fresh `bun run dev`, no boot errors.

- [ ] **Step 2: Confirm marketing site loads**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/`
Expected: `200`.

- [ ] **Step 3: Confirm an existing API route still works (regression check)**

Run: `curl -s -X POST -H "Content-Type: application/json" -d '{}' http://localhost:8080/api/public/contact -o /tmp/contact-resp.json -w "%{http_code}\n"`
Expected: HTTP `400` (the empty body fails Zod validation). NOT `500` or `404`.

If `500`: custom entry is broken. Check `src/server.ts` against Task 5; check that `bun run dev` printed no errors at boot.

If `404`: `wrangler.jsonc` `main` didn't update or the dev server didn't restart cleanly.

- [ ] **Step 4: NO COMMIT.** Verification only.

---

## Task 8: Switch contact.ts call site to use `keepAlive`

**Files:**
- Modify: `src/routes/api/public/contact.ts` (lines 13 + ~304-315)

- [ ] **Step 1: Add `keepAlive` import**

After the `import { classifyAndStore } from "@/lib/contact/classify-submission";` line (currently line 13), add:

```ts
import { keepAlive } from "@/lib/cloudflare/context";
```

- [ ] **Step 2: Replace the fire-and-forget call**

The current block (lines ~301-315) reads:

```ts
        // Fire-and-forget AI classification. Never blocks the response or
        // email delivery — failures are stamped on the row for the cron
        // sweeper to retry.
        if (insertedSubmission?.id) {
          void classifyAndStore(supabase, {
            id: insertedSubmission.id,
            name: payload.name,
            email: payload.email,
            company: payload.company || null,
            message: payload.message,
            budget: payload.budget || null,
          }).catch((err) => {
            console.warn("contact: inline classify failed (non-fatal)", err);
          });
        }
```

Replace with:

```ts
        // Fire-and-forget AI classification. Never blocks the response or
        // email delivery — failures are stamped on the row for the cron
        // sweeper to retry. `keepAlive` uses ctx.waitUntil on CF Workers so
        // the promise survives past response close; on Node it awaits inline.
        if (insertedSubmission?.id) {
          const classifyPromise = classifyAndStore(supabase, {
            id: insertedSubmission.id,
            name: payload.name,
            email: payload.email,
            company: payload.company || null,
            message: payload.message,
            budget: payload.budget || null,
          }).catch((err) => {
            console.warn("contact: inline classify failed (non-fatal)", err);
          });
          await keepAlive(classifyPromise);
        }
```

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 4: NO COMMIT YET — verify locally first.**

---

## Task 9: Verify local e2e — contact form classify works through the new entry

**Files:** (no edits)

- [ ] **Step 1: POST a contact submission**

Run:
```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"name":"plan-test","email":"delivered@resend.dev","message":"local verify of keepAlive scaffold","website":"","captcha":{"a":1,"b":1,"answer":2}}' \
  http://localhost:8080/api/public/contact
```
Expected: JSON body with `"success":true` and some `messageId`.

- [ ] **Step 2: Trigger the email dispatcher (so the row gets a sibling email_send_log entry — sanity)**

Run:
```bash
SERVICE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env | cut -d= -f2- | tr -d '"')
curl -sS -X POST -H "Authorization: Bearer $SERVICE_KEY" http://localhost:8080/lovable/email/queue/process
```
Expected: JSON OK.

- [ ] **Step 3: Wait 3 seconds, then query DB for the classified row**

```bash
sleep 3
SUPABASE_DB_URL=$(grep "^SUPABASE_DB_URL=" .env | cut -d= -f2- | tr -d '"')
/opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -c "SELECT id, name, sentiment, topic, priority_suggestion, classified_at, classification_error FROM public.contact_submissions WHERE name='plan-test' ORDER BY created_at DESC LIMIT 1;"
```

Expected: one row with `name=plan-test`, NON-NULL `sentiment` (one of positive/neutral/negative/urgent), NON-NULL `topic`, NON-NULL `priority_suggestion`, NON-NULL `classified_at` timestamp, and NULL `classification_error`.

If `classified_at` is NULL after 3s: wait 5s more and re-query (Anthropic call may be slow). If still NULL after 10s: classification didn't fire. Check dev server console for errors — likely `keepAlive` import path wrong, or ALS frame not populated (server.ts misconfigured).

If `classification_error` has a value: classification ran but failed (probably missing `ANTHROPIC_API_KEY` in `.env` or Anthropic API error). Different bug, not the scaffold.

- [ ] **Step 4: Commit call-site switchover**

```bash
git add src/routes/api/public/contact.ts
git commit -m "$(cat <<'EOF'
fix(contact): use keepAlive for AI classify so it survives on CF Workers

Replaces the `void classifyAndStore(...)` fire-and-forget at line 304
with `await keepAlive(classifyPromise)`. On CF Workers, keepAlive uses
ctx.waitUntil (sourced from the custom src/server.ts AsyncLocalStorage
frame) so the promise survives past response close. On Node/dev fallback
it awaits inline.

Closes the production half of ISSUES.md item-1. Pre-existing prod rows
with NULL classification columns are recoverable by the cron sweeper at
/api/public/hooks/classify-contact-submissions (if scheduled — see
ISSUES.md cron-job divergence note).

Verified locally: POST contact form → DB row classified within 3s.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 10: Authorization gate — request user permission for `wrangler deploy`

**Files:** (no edits)

This is a hard stop for autonomous execution per project rules: `git push + wrangler deploy + supabase functions deploy + migration apply = shared state, ASK first`.

- [ ] **Step 1: Confirm two commits are ahead of origin**

Run: `git log --oneline @{u}..HEAD`
Expected: two commits — one with `feat(cf): scaffold ...` and one with `fix(contact): use keepAlive ...`.

- [ ] **Step 2: Surface the deploy ask to the user**

Print:
```
Local e2e green. Two commits queued locally. Need authorization for two shared-state actions:

1. `git push origin main` — pushes the scaffold + call-site fix to origin
2. `bunx wrangler deploy` — deploys the new src/server.ts to genesisxsx Worker

Should I proceed with both, just one, or hold?
```

- [ ] **Step 3: WAIT for user response.** Do not proceed past this point autonomously.

---

## Task 11: Push + deploy (user-authorized only)

**Files:** (no edits)

- [ ] **Step 1: Push**

Run: `git push origin main`
Expected: push succeeds, two commits land on origin/main.

- [ ] **Step 2: Deploy worker**

Run: `bunx wrangler deploy`
Expected: deploy succeeds with a new worker version ID. Capture the version ID for ISSUES.md note.

If deploy fails on the custom entry import path: `src/server.ts`'s `@/lib/cloudflare/context` import resolves via `tsconfig.json` paths but wrangler's bundler may not honor them. Fallback: change `src/server.ts` import to relative path `./lib/cloudflare/context`.

- [ ] **Step 3: NO COMMIT.**

---

## Task 12: Verify prod e2e — contact form classify works through deployed worker

**Files:** (no edits)

- [ ] **Step 1: POST a contact submission to prod**

Run:
```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"name":"prod-verify-keepalive","email":"delivered@resend.dev","message":"prod verify of keepAlive scaffold","website":"","captcha":{"a":1,"b":1,"answer":2}}' \
  https://genesisxsx.darsh-pod.workers.dev/api/public/contact
```
Expected: JSON `{"success":true, ...}`.

- [ ] **Step 2: Wait 5 seconds, then query DB**

```bash
sleep 5
SUPABASE_DB_URL=$(grep "^SUPABASE_DB_URL=" .env | cut -d= -f2- | tr -d '"')
/opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -c "SELECT id, name, sentiment, topic, priority_suggestion, classified_at, classification_error FROM public.contact_submissions WHERE name='prod-verify-keepalive' ORDER BY created_at DESC LIMIT 1;"
```

Expected: row with NON-NULL `sentiment`, `topic`, `priority_suggestion`, `classified_at`, and NULL `classification_error`.

If `classified_at` still NULL after 10s: scaffold is wired but `waitUntil` isn't extending the lifecycle. Most likely cause: `ANTHROPIC_API_KEY` not set as a wrangler secret. Run `bunx wrangler secret list` to confirm.

If `classification_error` populated: classification fired but errored (Anthropic API issue). Scaffold is working; bug is elsewhere.

- [ ] **Step 3: Backfill the regression rows via the sweeper (optional)**

The pre-existing prod rows (including `e5a80cf9-0ab3-4171-9f56-ac120cb76b85` mentioned in ISSUES.md) are still NULL. If the sweeper endpoint is reachable:

```bash
CRON_SECRET_VALUE=$(/opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -tAc "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';" | tr -d '[:space:]')
curl -sS -X POST -H "x-cron-secret: $CRON_SECRET_VALUE" https://genesisxsx.darsh-pod.workers.dev/api/public/hooks/classify-contact-submissions
```
Expected: JSON with `processed > 0` and `succeeded >= 1`.

If the sweeper isn't scheduled on pg_cron (per ISSUES.md note), running it manually here is the backfill mechanism for now.

- [ ] **Step 4: NO COMMIT.** Verification only.

---

## Task 13: Update ISSUES.md to close item-1

**Files:**
- Modify: `ISSUES.md` (item-1 entry)

- [ ] **Step 1: Edit the item-1 entry**

Find the line starting with `**[Phase 1 regression] AI contact-form classification silently dropped on prod Cloudflare Worker.**` and convert it to strikethrough + add a "fixed" note pointing at the two commits and the spec/plan paths.

Example shape:
```
- ~~**[Phase 1 regression] AI contact-form classification silently dropped...**~~ **Fixed 2026-05-17 — commits <scaffold-sha> + <callsite-sha>. Custom src/server.ts wraps stock TanStack Start entry, captures CF (env, ctx, cf) into AsyncLocalStorage per request, exposed via getCloudflareContext(). contact.ts:304 now uses keepAlive(promise) which calls ctx.waitUntil on workerd. Prod verify: POST contact → row classified within 5s. Pre-existing NULL rows backfilled via cron sweeper manual poke. Spec: docs/superpowers/specs/2026-05-17-cloudflare-context-scaffold-design.md. Plan: docs/superpowers/plans/2026-05-17-cloudflare-context-scaffold.md.**
```

- [ ] **Step 2: Commit**

```bash
git add ISSUES.md
git commit -m "$(cat <<'EOF'
docs(issues): close item-1 — keepAlive scaffold deployed + verified

ISSUES.md item-1 (AI classify silently dropped on prod CF Worker) is
fixed. Custom src/server.ts wraps stock TanStack Start entry, captures
CF (env, ctx, cf) into AsyncLocalStorage per request. contact.ts uses
keepAlive(promise) which routes to ctx.waitUntil on workerd, await on
Node. Prod verify: POST contact → row classified within 5s.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push (user-authorized only)**

Ask: "ISSUES.md update committed. Push?" — wait for go before `git push`.

---

## Self-review

**1. Spec coverage:** Every file from the spec's architecture table maps to a task:
- `src/types/cloudflare-env.d.ts` → Task 2
- `src/lib/cloudflare/context.ts` → Task 4
- `src/server.ts` → Task 5
- `wrangler.jsonc` → Task 6
- `src/routes/api/public/contact.ts` → Task 8
- `tsconfig.json` → Task 3
- `package.json` (workers-types devDep) → Task 1

Spec rollout plan section maps to Tasks 6 (commit 1) + 9 (commit 2) + 10-11 (deploy gate) + 12 (prod verify) + 13 (close ISSUES.md).

**2. Placeholder scan:** No TBDs, TODOs, vague-handling. Each step has exact code or exact command + expected output.

**3. Type consistency:** `CloudflareRequestContext` interface used identically across Task 4 (definition), Task 5 (consumer in server.ts). `keepAlive` signature `<T>(promise: Promise<T>): Promise<void>` consistent between Task 4 (definition) and Task 8 (consumer). `CloudflareEnv` interface uses `declare global` in Task 2, referenced as a bare identifier in Tasks 4 + 5 — matches.

No gaps found.

---

## Follow-on (out of scope for this plan)

The α-batch user asked for also includes:
- Welcome-email cron migration (separate plan/commit, no design needed)
- Stale-test-user delete (separate, destructive, needs user confirm)

Those land as straight follow-on commits after item-1 is closed, not as tasks in this plan.
