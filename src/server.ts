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
import startEntry from "@tanstack/react-start/server-entry";
import { runWithCloudflareContext } from "@/lib/cloudflare/context";

type DelegateFetch = (req: Request, env: unknown, ctx: unknown) => Promise<Response>;

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext | undefined,
  ): Promise<Response> {
    const delegate = (startEntry as { fetch: DelegateFetch }).fetch;

    // Some runtime paths (e.g. vite dev's internal route preload) invoke the
    // worker entry without a real ExecutionContext. Skip the ALS frame in
    // that case — getCloudflareContext() returns undefined and keepAlive
    // falls back to inline await, which is correct on Node.
    if (!ctx || typeof ctx.waitUntil !== "function") {
      return delegate(request, env, ctx);
    }

    return runWithCloudflareContext(
      {
        env: env as CloudflareEnv,
        ctx,
        cf: (request as Request & { cf?: IncomingRequestCfProperties }).cf,
      },
      () => delegate(request, env, ctx),
    );
  },
};
