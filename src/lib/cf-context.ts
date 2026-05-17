import { AsyncLocalStorage } from "node:async_hooks";

interface CloudflareRequestCtx {
  waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Per-request store of Cloudflare's ExecutionContext.waitUntil. Populated by
 * src/server-entry.ts before handing each request to TanStack Start, then
 * read by any route handler that wants to keep a background promise alive
 * after returning its Response.
 */
export const cfCtxStorage = new AsyncLocalStorage<CloudflareRequestCtx>();

/**
 * Run a background promise correctly on every runtime.
 *
 * On Cloudflare Workers the request lifecycle ends as soon as the handler
 * returns its Response, and any unawaited promise gets dropped. waitUntil()
 * extends the lifecycle until the promise settles. On Node (vite dev,
 * tests, anywhere AsyncLocalStorage hasn't been populated by a CF entry)
 * we fall back to a fire-and-forget void, which works because the Node
 * event loop stays alive past the response.
 */
export function waitUntilBackground(promise: Promise<unknown>): void {
  const store = cfCtxStorage.getStore();
  if (store) {
    store.waitUntil(promise);
    return;
  }
  void promise.catch(() => {});
}
