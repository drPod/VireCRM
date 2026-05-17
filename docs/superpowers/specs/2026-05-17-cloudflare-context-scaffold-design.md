# Cloudflare Runtime Context Scaffold — Design

**Status:** Draft for user review
**Date:** 2026-05-17
**Author:** Claude Opus 4.7 (autonomous session, see ISSUES.md item-1)
**Project:** genesisxsx (TanStack Start + Cloudflare Workers)

## Background

The contact-form route at `src/routes/api/public/contact.ts:304` calls `void classifyAndStore(...)` fire-and-forget after returning the response. Local Vite kept the promise alive because Node's event loop holds unawaited promises past response close. Cloudflare Workers tear down the request lifecycle the moment the handler returns `Response`, so the Anthropic SDK fetch inside `classifyAndStore` never completes. Result: every contact submission on prod has NULL `sentiment`, `topic`, `priority_suggestion`, `intent_summary`, and `classified_at` columns AND NULL `classification_error` (because the error never gets a chance to fire).

The Cloudflare-native fix is `ctx.waitUntil(promise)`, which extends the worker's lifetime to wait for `promise` after the response goes out. But `ctx` is only handed to the worker's outer `fetch(request, env, ctx)` handler, and TanStack Start's stock server entry (`@tanstack/react-start/server-entry`) only passes `request` through to route handlers — `env` and `ctx` are dropped.

This spec covers a custom server entry that captures the Cloudflare runtime context per-request and exposes it to route handlers via an `AsyncLocalStorage`-backed accessor. The scaffold is deliberately built to extend cleanly when bindings (KV, D1, R2, Durable Objects, Queues) get added later — the same `getCloudflareContext()` accessor that returns `ctx.waitUntil` today will return `env.MY_KV` tomorrow.

## Goals

1. Route handlers can invoke `ctx.waitUntil(promise)` to extend the worker lifecycle for fire-and-forget work.
2. Future bindings (KV, D1, R2, DO, Queues) are accessible through a single typed accessor — adding a new binding is `wrangler.jsonc` edit + interface extension + zero new plumbing.
3. Works identically in `bun run dev` (workerd via `@cloudflare/vite-plugin`) and `wrangler deploy` (workerd in prod).
4. Graceful fallback for any code path that runs outside a worker request (unit tests, one-shot scripts, build-time): the accessor returns `undefined`, and call sites can `await` the promise as a Node fallback.
5. No regression in any existing route. Specifically: contact form, all cron hooks, all auth flows, all Stripe checkout flows.

## Non-goals

1. NOT bundling a unit-testing harness for the helper (no test infra exists in this repo). Integration tests are manual via curl.
2. NOT migrating other fire-and-forget call sites in the codebase as part of this change. The only known offender is `contact.ts:304`. If others surface, fix them in follow-on commits.
3. NOT building a polyfill for non-workerd runtimes. The Node fallback (`await` instead of `waitUntil`) is sufficient for the test/script case.
4. NOT replacing `process.env.X` reads throughout the codebase with `getCloudflareContext().env.X`. Existing reads stay as-is; the typed `CloudflareEnv` interface is for new code or refactors when convenient.

## Architecture

### Files

| File | New/Edit | Lines (est) | Purpose |
|------|----------|-------------|---------|
| `src/types/cloudflare-env.d.ts` | New | ~30 | Typed `CloudflareEnv` interface — every env var the worker reads. |
| `src/lib/cloudflare/context.ts` | New | ~50 | `AsyncLocalStorage` singleton + `runWithCloudflareContext` (setter) + `getCloudflareContext` (getter) + `keepAlive` (ergonomic wrapper for `waitUntil` with Node fallback). |
| `src/server.ts` | New | ~15 | Custom CF Worker entry. Imports stock TanStack Start handler, wraps each request in `runWithCloudflareContext`. |
| `wrangler.jsonc` | Edit | 1 line | Change `main` from `@tanstack/react-start/server-entry` to `./src/server.ts`. |
| `src/routes/api/public/contact.ts` | Edit | ~5 lines around line 304 | Replace `void classifyAndStore(...).catch(...)` with `keepAlive(classifyAndStore(...))`. |
| `tsconfig.json` | Edit | 1 line | Add `"@cloudflare/workers-types"` to `compilerOptions.types` array (currently only `["vite/client"]`). |
| `package.json` | Edit | 1 line + lockfile | `bun add -d @cloudflare/workers-types` — not currently installed, even transitively. Verified via `find node_modules -name workers-types`. |

3 new files, 4 edits.

### Request lifecycle

```
Incoming HTTP request
  └── workerd dispatches to default export
       └── src/server.ts fetch(request, env, ctx)
            └── runWithCloudflareContext({ env, ctx, cf: request.cf }, () =>
                 └── handler.fetch(request)              ← TanStack Start runs
                      └── matches route /api/public/contact
                           └── POST handler body
                                └── parseAndValidate(...)
                                └── insertSubmission(...)
                                └── const cf = getCloudflareContext()
                                └── keepAlive(classifyAndStore(...))  ← uses cf.ctx.waitUntil
                                └── enqueueEmail(...)
                                └── return Response(JSON success)
            )
        ← ALS pops the store
        ← runtime keeps the worker alive until waitUntil promise settles
        ← classifyAndStore writes row, marks classified_at
```

`AsyncLocalStorage` provides per-request isolation. Two simultaneous POSTs each get a distinct `{ env, ctx, cf }` object — no coordination required and no race conditions on the shared singleton.

### Component contracts

**`src/lib/cloudflare/context.ts`** exports four symbols:

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface CloudflareRequestContext {
  env: CloudflareEnv;
  ctx: ExecutionContext;
  cf: IncomingRequestCfProperties | undefined;
}

const cloudflareContextStore = new AsyncLocalStorage<CloudflareRequestContext>();

export function runWithCloudflareContext<T>(
  value: CloudflareRequestContext,
  fn: () => T,
): T {
  return cloudflareContextStore.run(value, fn);
}

export function getCloudflareContext(): CloudflareRequestContext | undefined {
  return cloudflareContextStore.getStore();
}

/**
 * Fire-and-forget a promise so it survives past response close on Cloudflare Workers.
 * Falls back to await on non-worker runtimes (tests, scripts).
 */
export async function keepAlive<T>(promise: Promise<T>): Promise<void> {
  const cf = getCloudflareContext();
  if (cf) {
    cf.ctx.waitUntil(promise.then(() => undefined));
  } else {
    // Node fallback: ensure rejections are swallowed (caller is responsible
    // for their own error handling inside `promise`)
    await promise.catch(() => undefined);
  }
}
```

**`src/server.ts`:**

```ts
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { runWithCloudflareContext } from "@/lib/cloudflare/context";

export default createServerEntry({
  async fetch(request, env, ctx) {
    return runWithCloudflareContext(
      { env: env as CloudflareEnv, ctx, cf: (request as any).cf },
      () => handler.fetch(request),
    );
  },
});
```

**`src/types/cloudflare-env.d.ts`** (initial inventory from env audit):

```ts
/// <reference types="@cloudflare/workers-types" />

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

    // Future bindings land here:
    // MY_KV: KVNamespace;
    // DB: D1Database;
    // ASSETS: R2Bucket;
  }
}

export {};
```

**`src/routes/api/public/contact.ts` change** (only diff at line ~304):

```ts
// Before:
if (insertedSubmission?.id) {
  void classifyAndStore(supabase, { ... }).catch((err) => {
    console.warn("contact: inline classify failed (non-fatal)", err);
  });
}

// After:
if (insertedSubmission?.id) {
  const classifyPromise = classifyAndStore(supabase, { ... }).catch((err) => {
    console.warn("contact: inline classify failed (non-fatal)", err);
  });
  await keepAlive(classifyPromise);
}
```

`keepAlive` is `async` but resolves immediately on CF (it just registers with `waitUntil`); the `await` is purely for the Node fallback branch.

### Data flow

1. CF Workers fetch handler receives `(request, env, ctx)`.
2. `runWithCloudflareContext` pushes `{ env, ctx, cf }` onto a per-request ALS frame.
3. TanStack Start handler matches the route and invokes the POST function.
4. Route handler does its work, optionally calling `getCloudflareContext()` to access env/ctx.
5. Route handler returns Response.
6. ALS frame pops as the synchronous part of `handler.fetch` completes.
7. Workers runtime sees outstanding `waitUntil` promises and holds the worker alive until they settle.
8. Promise (classify-and-store) completes, writes to Supabase, exits.
9. Workers runtime tears down the worker invocation.

### Error handling

- **Inside `keepAlive`'s waitUntil promise:** Caller is responsible for `.catch` on the inner promise (the contact.ts site already does this — `console.warn` on failure). Rejected `waitUntil` promises are surfaced in Workers logs but don't affect the already-sent Response.
- **`getCloudflareContext()` returns `undefined`:** Means this code path didn't go through the worker entry. Tests + scripts hit this. `keepAlive` handles it by awaiting inline; other consumers that read `env` directly need a defensive null check or a `runWithCloudflareContext` wrapper in their test harness.
- **`env` cast safety:** `env as CloudflareEnv` is asserted, not validated. If a required key is missing in `wrangler.jsonc` vars + secrets, reading `env.ANTHROPIC_API_KEY` returns `undefined` and the downstream `new Anthropic({apiKey: ...})` will throw. Same failure mode as today (`process.env.ANTHROPIC_API_KEY` is also undefined on missing secret). No regression.

### Testing strategy

This repo has no unit-test harness. Verification is via integration test, manual:

1. **Static:** `bun run typecheck` clean. Catches any type errors in the helper or the env interface.
2. **Dev parity:** `bun run dev`, POST the contact form, observe the DB row gets classified within ~3s. Proves workerd-in-vite-dev hands ctx + env through correctly.
3. **Prod proof:** After `wrangler deploy` (user-authorized), POST the contact form on `https://genesisxsx.darsh-pod.workers.dev`, observe the row gets classified within ~5s (waitUntil keeps the promise alive past response).
4. **No regression:** Spot-check at least one cron hook (e.g. `POST /api/public/hooks/dispatch-followups` with `x-cron-secret`) and one Stripe checkout flow to confirm the custom entry didn't break unrelated routes.

### Rollback

If the custom entry breaks anything in prod:

1. Revert `wrangler.jsonc` `main` to `"@tanstack/react-start/server-entry"`.
2. `wrangler deploy`.
3. Contact form goes back to the original silent-drop behavior (item-1 regression returns), but everything else works as before.

The new files (`src/server.ts`, `src/lib/cloudflare/context.ts`, `src/types/cloudflare-env.d.ts`) can stay in the tree — they're only used when `wrangler.jsonc` points `main` at them. The `contact.ts` edit also needs reverting to drop the `keepAlive` import.

Net rollback cost: 2 file reverts + 1 redeploy. ~5 minutes.

## Out-of-scope cleanup discovered during env audit

The env inventory subagent surfaced one pre-existing bug, NOT fixed in this scaffold:

- `src/routes/api/public/hooks/contact-followup-reminders.ts` and `src/routes/api/public/hooks/dispatch-followups.ts` read `process.env.VITE_SUPABASE_URL` — this is always `undefined` at runtime because Vite only exposes VITE-prefixed vars through `import.meta.env`. The fallback chains hide the bug because `process.env.SUPABASE_URL` is set in wrangler.jsonc and short-circuits, but if either site ever loses the wrangler var, the route 500s. Logged separately in ISSUES.md as a follow-on cleanup.

## Risks

1. **TanStack Start internal API stability.** `@tanstack/react-start/server-entry`'s `createServerEntry` API is stable per docs as of v1.167+ (we're on ^1.167.14). The `handler` default export is what gets wrapped. Low risk but pin to current minor version range, don't auto-bump major.
2. **AsyncLocalStorage cross-request leakage.** ALS frames are per-request because `.run(value, fn)` pushes synchronously and `handler.fetch` returns a promise that captures the frame. Tested in production by `@opennextjs/cloudflare`, `next-on-pages`, and SvelteKit's CF adapter. Very low risk.
3. **`env` shape drift.** New env vars added via `wrangler.jsonc` vars or `wrangler secret put` without updating `CloudflareEnv` interface will show up as `string | undefined` in TS. Acceptable cost (the var is still readable at runtime; only TS narrowing suffers). Mitigation: add a CLAUDE.md note "edit `src/types/cloudflare-env.d.ts` when adding env vars."

## Open questions

None. (Env-inventory question from brainstorming is resolved by the audit above.)

## Rollout plan

1. **Commit 1 — scaffold:** `bun add -d @cloudflare/workers-types` + 3 new files (`src/types/cloudflare-env.d.ts`, `src/lib/cloudflare/context.ts`, `src/server.ts`) + `tsconfig.json` types-array edit + `wrangler.jsonc` `main` edit.
2. Verify: `bun run typecheck` clean.
3. **Commit 2 — call site:** `src/routes/api/public/contact.ts` switches to `keepAlive(...)`.
4. Verify: `bun run typecheck` clean + local dev e2e (`POST` contact form, watch row classify).
5. User authorizes `wrangler deploy`.
6. Prod e2e test (`curl POST` contact form on `genesisxsx.darsh-pod.workers.dev`, query DB row).
7. If green: append "fixed" note to ISSUES.md item-1.

Two commits, one deploy authorization point.
