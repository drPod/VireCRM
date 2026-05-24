import { Hono } from "hono";
import { requestId } from "hono/request-id";
import type { HonoEnv } from "./types";
import { corsMiddleware } from "./middleware/cors";
import { errorBoundary } from "./middleware/error-boundary";
import { jwtVerify } from "./middleware/jwt-verify";
import { tenantContext } from "./middleware/tenant-context";
import { healthRoutes } from "./routes/health";
import { agentsRoutes } from "./routes/agents";
import { customersRoutes } from "./routes/customers";

// Middleware order (every protected request):
//   cors → request-id → error-boundary → jwt-verify → tenant-context → handler
//
// cors first so OPTIONS preflight short-circuits with no auth check (otherwise
// browsers see 401 on preflight and never send the real request). request-id +
// error-boundary apply to /health too so 500s and tracing aren't auth-gated.
export const api = new Hono<HonoEnv>().basePath("/api");

api.use("*", corsMiddleware);
api.use("*", requestId());
api.use("*", errorBoundary);

api.route("/health", healthRoutes);

const protectedApi = new Hono<HonoEnv>();
protectedApi.use("*", jwtVerify);
protectedApi.use("*", tenantContext);
protectedApi.route("/agents", agentsRoutes);
protectedApi.route("/customers", customersRoutes);

api.route("/", protectedApi);
