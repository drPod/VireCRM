import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { corsMiddleware } from "./middleware/cors";
import { errorBoundary } from "./middleware/error-boundary";
import { jwtVerify } from "./middleware/jwt-verify";
import { tenantContext } from "./middleware/tenant-context";
import { agentsRoutes } from "./routes/agents";
import { aggregatorPayoutsRoutes } from "./routes/aggregator-payouts";
import { authRoutes } from "./routes/auth";
import { commissionReconciliationRoutes } from "./routes/commission-reconciliation";
import { commissionStatementsRoutes } from "./routes/commission-statements";
import { contractsRoutes } from "./routes/contracts";
import { currentClientsRoutes } from "./routes/current-clients";
import { customersRoutes } from "./routes/customers";
import { dealsRoutes } from "./routes/deals";
import { esisRoutes } from "./routes/esis";
import { healthRoutes } from "./routes/health";
import { loasRoutes } from "./routes/loas";
import { renewalsRoutes } from "./routes/renewals";
import { serviceAddressesRoutes } from "./routes/service-addresses";
import type { HonoEnv } from "./types";

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
protectedApi.route("/aggregator-payouts", aggregatorPayoutsRoutes);
protectedApi.route("/auth", authRoutes);
protectedApi.route("/commission-reconciliation", commissionReconciliationRoutes);
protectedApi.route("/commission-statements", commissionStatementsRoutes);
protectedApi.route("/contracts", contractsRoutes);
protectedApi.route("/current-clients", currentClientsRoutes);
protectedApi.route("/customers", customersRoutes);
protectedApi.route("/deals", dealsRoutes);
protectedApi.route("/esis", esisRoutes);
protectedApi.route("/loas", loasRoutes);
protectedApi.route("/renewals", renewalsRoutes);
protectedApi.route("/service-addresses", serviceAddressesRoutes);

api.route("/", protectedApi);
