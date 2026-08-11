import * as Sentry from "@sentry/cloudflare";
import type { MiddlewareHandler } from "hono";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

// Catches uncaught throws from downstream middleware / handlers. Logs the raw
// error (visible in `wrangler tail` + Workers Logs) but never echoes the
// message to the client — prevents stack-trace / schema leakage on 500s.
export const errorBoundary: MiddlewareHandler<HonoEnv> = async (c, next) => {
  try {
    await next();
  } catch (err) {
    // withSentry only catches unhandled; this captures what middleware swallows.
    Sentry.captureException(err);
    console.error("[api] unhandled error", {
      requestId: c.get("requestId"),
      path: c.req.path,
      method: c.req.method,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    return jsonError(c, 500, "INTERNAL");
  }
};
