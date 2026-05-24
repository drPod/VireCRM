import * as Sentry from "@sentry/cloudflare";
import { createRequestHandler } from "react-router";
import { api } from "./api";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    return reactRouterHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;

// `withSentry` no-ops when `dsn` is empty (Sentry SDK contract), so the Worker
// runs unchanged in environments where SENTRY_DSN_PUBLIC has not been set.
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN_PUBLIC,
    release: env.CF_VERSION_METADATA?.id ?? "unknown",
    // 100% transaction sampling — free-tier 5K events/mo cap; revisit at scale or when Stripe billing lands.
    tracesSampleRate: 1.0,
  }),
  handler,
);
