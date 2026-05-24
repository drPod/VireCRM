import { Hono } from "hono";
import type { HonoEnv } from "../types";

// `GET /api/auth/whoami` — the SPA login flow calls this right after
// `supabase.auth.signInWithPassword` resolves so the Worker can confirm the
// JWT's tenant/role context matches the request host BEFORE the user lands
// on an auth-gated page.
//
// Reaching this handler proves jwtVerify + tenantContext both passed. Any
// mismatch (TENANT_MISMATCH, CUSTOMER_PORTAL_NOT_ALLOWED, TENANT_CLAIM_MISSING)
// will have already been turned into a 403 by the middleware stack. The
// response body intentionally carries only IDs the caller already has access
// to via their JWT — nothing new is leaked here.
export const authRoutes = new Hono<HonoEnv>().get("/whoami", (c) => {
  const claims = c.get("jwtClaims");
  const appMeta = claims.app_metadata as { role?: unknown } | undefined;
  const role =
    typeof appMeta?.role === "string" ? appMeta.role : claims.role ?? null;

  return c.json({
    tenantId: c.get("tenantId"),
    userId: c.get("userId"),
    role,
  });
});
