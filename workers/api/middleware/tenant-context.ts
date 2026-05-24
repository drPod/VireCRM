import type { MiddlewareHandler } from "hono";
import { jsonError } from "../lib/errors";
import { extractSubdomain, isReservedSubdomain } from "../lib/subdomain";
import { makeCache } from "../lib/cache";
import { loadTenantBySubdomain } from "../../db/queries/tenants";
import { getDb } from "../get-db";
import type { HonoEnv } from "../types";

// Resolves the request's tenant by cross-checking the host's subdomain against
// the JWT's `app_metadata.tenant_id` claim. Mismatch or missing claim = 403 with
// no leaked detail (response body never echoes claim vs expected). This is the
// only place broker tenants are derived — handlers downstream read `tenantId`.
//
// Reads the host from `c.req.url` (URL of the request), NOT `c.req.header("host")`.
// In production both match — CF Workers populate the Host header from the
// request line. Under Miniflare's `SELF.fetch` test harness, however, the
// constructed Request carries the URL but no Host header, so reading from the
// header would return `undefined` and short-circuit every test request to 403
// `TENANT_SCOPE_INVALID`. The URL is the canonical source either way.
export const tenantContext: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const sub = extractSubdomain(new URL(c.req.url).hostname);
  if (!sub || isReservedSubdomain(sub)) {
    return jsonError(c, 403, "TENANT_SCOPE_INVALID");
  }

  const cache = makeCache(c.env.CACHE, c.executionCtx);
  const tenant = await cache.get(
    `tenant:by-sub:${sub}`,
    async () => loadTenantBySubdomain(getDb(c), sub),
  );
  if (!tenant) return jsonError(c, 403, "TENANT_UNKNOWN");

  const jwtClaims = c.get("jwtClaims");
  const appMeta = jwtClaims.app_metadata as
    | { tenant_id?: unknown; role?: unknown }
    | undefined;

  // Customer-portal JWTs (`customers.virecrm.com`) carry `role: customer`.
  // They must never authenticate against broker subdomains — refuse here
  // before the tenant_id check, so the response code is unambiguous.
  if (jwtClaims.role === "customer" || appMeta?.role === "customer") {
    return jsonError(c, 403, "CUSTOMER_PORTAL_NOT_ALLOWED");
  }

  if (typeof appMeta?.tenant_id !== "string") {
    return jsonError(c, 403, "TENANT_CLAIM_MISSING");
  }
  if (appMeta.tenant_id !== tenant.id) {
    return jsonError(c, 403, "TENANT_MISMATCH");
  }

  c.set("tenantId", tenant.id);
  await next();
};
