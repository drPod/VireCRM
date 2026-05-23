import { Hono } from "hono";
import type { HonoEnv } from "../types";

// Public liveness check. Mounted on the root app *before* the protected
// sub-router so it bypasses JWT verify entirely. Don't add DB pings here —
// /health must stay cheap so uptime monitors don't burn Hyperdrive connections.
export const healthRoutes = new Hono<HonoEnv>().get("/", (c) => c.json({ ok: true }));
