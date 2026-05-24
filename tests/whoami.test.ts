import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  HOST_TENANT_B,
  getSeededTenantIds,
  hasTestDb,
  mintJwt,
} from "./setup";

const url = (host: string, path = "/api/auth/whoami") => `https://${host}${path}`;

describe("GET /api/auth/whoami", () => {
  it("rejects no-token requests with 401 INVALID_CREDENTIALS", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it.skipIf(!hasTestDb)(
    "returns 200 with {tenantId, userId, role} when host + claim match",
    async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        tenantId: string;
        userId: string;
        role: string | null;
      };
      expect(body.tenantId).toBe(ids.a);
      expect(typeof body.userId).toBe("string");
      expect(body.userId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(body.role).toBe("authenticated");
    },
  );

  it.skipIf(!hasTestDb)(
    "rejects host/claim mismatch with 403 TENANT_MISMATCH",
    async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_B), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("TENANT_MISMATCH");
    },
  );

  it.skipIf(!hasTestDb)(
    "rejects role:customer JWTs with 403 CUSTOMER_PORTAL_NOT_ALLOWED",
    async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({
        tenantId: ids.a,
        appMetadataRole: "customer",
      });
      const res = await SELF.fetch(url(HOST_TENANT_A), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("CUSTOMER_PORTAL_NOT_ALLOWED");
    },
  );

  it.skipIf(!hasTestDb)(
    "rejects JWTs without app_metadata.tenant_id with 403 TENANT_CLAIM_MISSING",
    async () => {
      const token = await mintJwt({ tenantId: null });
      const res = await SELF.fetch(url(HOST_TENANT_A), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("TENANT_CLAIM_MISSING");
    },
  );
});
