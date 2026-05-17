/**
 * Custom Cloudflare Workers entry. Wraps TanStack Start's default entry so
 * we can stash the ExecutionContext.waitUntil into AsyncLocalStorage on
 * every request. Route handlers read it via lib/cf-context.ts to keep
 * background work (e.g. AI classify of contact submissions) alive past the
 * Response return — without that, CF Workers drop unawaited promises and
 * fire-and-forget patterns that work on Node silently fail in prod.
 */
import startEntry from "@tanstack/react-start/server-entry";
import { cfCtxStorage } from "./lib/cf-context";

interface ExecutionContextShape {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
}

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: ExecutionContextShape,
  ): Promise<Response> {
    return cfCtxStorage.run({ waitUntil: ctx.waitUntil.bind(ctx) }, () =>
      (startEntry as { fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response> }).fetch(
        request,
        env,
        ctx,
      ),
    );
  },
};
