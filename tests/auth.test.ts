import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  HOST_TENANT_B,
  getSeededTenantIds,
  hasTestDb,
  mintHs256Jwt,
  mintJwt,
} from "./setup";

const url = (host: string, path = "/api/customers") => `https://${host}${path}`;

describe("auth middleware", () => {
  it("rejects no-token requests with 401 INVALID_CREDENTIALS", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    // Don't leak a basic-auth challenge — would trigger browser prompts.
    expect(res.headers.get("www-authenticate")).toBeNull();
  });

  it("rejects HS256 tokens with 401", async () => {
    const token = await mintHs256Jwt();
    const res = await SELF.fetch(url(HOST_TENANT_A), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects expired tokens with 401", async () => {
    const token = await mintJwt({ expiresInSeconds: -60 });
    const res = await SELF.fetch(url(HOST_TENANT_A), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it.skipIf(!hasTestDb)(
    "rejects host/claim mismatch with 403 TENANT_MISMATCH",
    async () => {
      const ids = await getSeededTenantIds();
      // JWT carries tenant A's id, but request hits tenant B's host.
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_B), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      expect(body.error?.code).toBe("TENANT_MISMATCH");
      // Never leak which side the mismatch was on.
      expect(body.error?.message).not.toContain(ids.a);
      expect(body.error?.message).not.toContain(ids.b);
    },
  );

  it.skipIf(!hasTestDb)(
    "rejects missing app_metadata.tenant_id with 403 TENANT_CLAIM_MISSING",
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

  it.skipIf(!hasTestDb)(
    "rejects role:customer JWTs on broker subdomains with 403 CUSTOMER_PORTAL_NOT_ALLOWED",
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
});
