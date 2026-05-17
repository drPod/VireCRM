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
