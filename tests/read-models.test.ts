import { SELF, env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  HOST_TENANT_B,
  getSeededTenantIds,
  hasTestDb,
  mintJwt,
} from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

// Read-only endpoints added for the frontend: /api/agents, /api/esis,
// /api/service-addresses, /api/current-clients. One seeded chain
// (customer → address → esi → contracts) exercises all four.
describe.skipIf(!hasTestDb)("read-model endpoints", () => {
  let tenantA: string;
  let token: string;
  let agentId: string;
  let customerId: string;
  let addressId: string;
  let esiRowId: string;
  let activeContractId: string;
  let pendingContractId: string;

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    tenantA = ids.a;
    token = await mintJwt({ tenantId: tenantA });

    const { makeDb } = await import("../workers/db");
    const { agents, contracts, customers, esis, serviceAddresses } = await import(
      "../workers/db/schema"
    );
    const { withTenantContext } = await import("../workers/db/with-tenant-context");
    const db = makeDb(env);

    await withTenantContext(db, tenantA, async (tx) => {
      const [agent] = await tx
        .insert(agents)
        .values({ tenantId: tenantA, name: "read-model-agent", email: "rm@example.com" })
        .returning({ id: agents.id });
      agentId = agent!.id;

      const [customer] = await tx
        .insert(customers)
        .values({ tenantId: tenantA, name: "read-model-customer" })
        .returning({ id: customers.id });
      customerId = customer!.id;

      const [address] = await tx
        .insert(serviceAddresses)
        .values({
          tenantId: tenantA,
          customerId,
          addressLine1: "100 Main St",
          city: "Dallas",
          state: "TX",
          zip: "75201",
        })
        .returning({ id: serviceAddresses.id });
      addressId = address!.id;

      const [esi] = await tx
        .insert(esis)
        .values({
          tenantId: tenantA,
          serviceAddressId: addressId,
          esiId: "10443720000012345",
          physicalMeterSerial: "MTR-9",
        })
        .returning({ id: esis.id });
      esiRowId = esi!.id;

      const [active] = await tx
        .insert(contracts)
        .values({
          tenantId: tenantA,
          esiId: esiRowId,
          supplier: "read-model-rep",
          pipelineStatus: "active",
          startDate: "2026-01-01",
          endDate: "2028-01-01",
          agentMils: "5",
          annualUsageKwh: "100000",
        })
        .returning({ id: contracts.id });
      activeContractId = active!.id;

      const [pending] = await tx
        .insert(contracts)
        .values({ tenantId: tenantA, esiId: esiRowId, pipelineStatus: "pending" })
        .returning({ id: contracts.id });
      pendingContractId = pending!.id;
    });
  });

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { agents, contracts, customers } = await import("../workers/db/schema");
    const { inArray, eq } = await import("drizzle-orm");
    const db = makeDb(env);
    // contracts first (esis FK is restrict); customer cascades address + esi.
    await db
      .delete(contracts)
      .where(inArray(contracts.id, [activeContractId, pendingContractId].filter(Boolean)));
    if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
    if (agentId) await db.delete(agents).where(eq(agents.id, agentId));
  });

  it("GET /api/agents lists the seeded agent; get-by-id round-trips", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/agents?limit=100"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; name: string }>;
      nextCursor: string | null;
    };
    expect(body.items.some((a) => a.id === agentId)).toBe(true);

    const one = await SELF.fetch(url(HOST_TENANT_A, `/api/agents/${agentId}`), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(one.status).toBe(200);
    const agent = (await one.json()) as { id: string; name: string; email: string | null };
    expect(agent.name).toBe("read-model-agent");
  });

  it("tenant B cannot see tenant A's agent (404, not 403)", async () => {
    const ids = await getSeededTenantIds();
    const tokenB = await mintJwt({ tenantId: ids.b });
    const res = await SELF.fetch(url(HOST_TENANT_B, `/api/agents/${agentId}`), {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/service-addresses filters by customerId", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/service-addresses?customerId=${customerId}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; city: string | null }> };
    expect(body.items.map((a) => a.id)).toContain(addressId);
    expect(body.items.every((a) => a.id !== undefined)).toBe(true);
  });

  it("GET /api/esis filters by customerId (via address join) and serviceAddressId", async () => {
    const byCustomer = await SELF.fetch(
      url(HOST_TENANT_A, `/api/esis?customerId=${customerId}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(byCustomer.status).toBe(200);
    const cBody = (await byCustomer.json()) as {
      items: Array<{ id: string; esiId: string }>;
    };
    expect(cBody.items.map((e) => e.id)).toContain(esiRowId);

    const byAddress = await SELF.fetch(
      url(HOST_TENANT_A, `/api/esis?serviceAddressId=${addressId}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    const aBody = (await byAddress.json()) as { items: Array<{ esiId: string }> };
    expect(aBody.items.some((e) => e.esiId === "10443720000012345")).toBe(true);
  });

  it("GET /api/current-clients returns joined active contracts only", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/current-clients?customerId=${customerId}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        contractId: string;
        esiId: string;
        customerName: string;
        supplier: string | null;
        grossTcv: string | null;
      }>;
      nextCursor: string | null;
    };
    const row = body.items.find((r) => r.contractId === activeContractId);
    expect(row).toBeDefined();
    expect(row!.esiId).toBe("10443720000012345");
    expect(row!.customerName).toBe("read-model-customer");
    expect(row!.supplier).toBe("read-model-rep");
    // generated column present and non-null (usage, dates, mils all set)
    expect(row!.grossTcv).not.toBeNull();
    // pending contract excluded
    expect(body.items.some((r) => r.contractId === pendingContractId)).toBe(false);
  });

  it("rejects limit=999 with 400 VALIDATION on each new endpoint", async () => {
    for (const path of [
      "/api/agents?limit=999",
      "/api/esis?limit=999",
      "/api/service-addresses?limit=999",
      "/api/current-clients?limit=999",
    ]) {
      const res = await SELF.fetch(url(HOST_TENANT_A, path), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("VALIDATION");
    }
  });
});
