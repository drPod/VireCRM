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

interface Page {
  items: Array<{
    id: string;
    contractId: string;
    aggregatorName: string;
    aggregatorCommPct: string | null;
    amount: string | null;
  }>;
  nextCursor: string | null;
}

// Seeds a full FK chain (customer → service_address → esi → contract) for a
// tenant. Returns `{ contractId, customerId }` — the customerId is the cascade
// root used for teardown (`ON DELETE CASCADE` reaches everything below).
async function seedContract(
  tenantId: string,
): Promise<{ contractId: string; customerId: string }> {
  const { makeDb } = await import("../workers/db");
  const {
    customers,
    serviceAddresses,
    esis,
    contracts,
  } = await import("../workers/db/schema");
  const { withTenantContext } = await import("../workers/db/with-tenant-context");
  const db = makeDb(env);

  return withTenantContext(db, tenantId, async (tx) => {
    const [c] = await tx
      .insert(customers)
      .values({ tenantId, name: "agg-payout-seed-customer" })
      .returning({ id: customers.id });
    const [sa] = await tx
      .insert(serviceAddresses)
      .values({ tenantId, customerId: c!.id })
      .returning({ id: serviceAddresses.id });
    const [e] = await tx
      .insert(esis)
      .values({
        tenantId,
        serviceAddressId: sa!.id,
        esiId: `10443720000${Date.now()}${Math.floor(Math.random() * 1000)}`,
      })
      .returning({ id: esis.id });
    const [ct] = await tx
      .insert(contracts)
      .values({ tenantId, esiId: e!.id })
      .returning({ id: contracts.id });
    return { contractId: ct!.id, customerId: c!.id };
  });
}

describe.skipIf(!hasTestDb)("aggregator-payouts CRUD", () => {
  // Tracks every customer the suite inserts so an `ON DELETE CASCADE` chain
  // (customer → service_address → esi → contract → aggregator_payout) cleans
  // up at the end. Avoids leaking seed data across test runs.
  const insertedCustomerIds: string[] = [];
  let contractIdA: string;
  let contractIdA2: string;
  let contractIdB: string;

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    const seedA = await seedContract(ids.a);
    const seedA2 = await seedContract(ids.a);
    const seedB = await seedContract(ids.b);
    contractIdA = seedA.contractId;
    contractIdA2 = seedA2.contractId;
    contractIdB = seedB.contractId;
    insertedCustomerIds.push(seedA.customerId, seedA2.customerId, seedB.customerId);
  });

  afterAll(async () => {
    if (insertedCustomerIds.length === 0) return;
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    // BYPASSRLS via `postgres` role for cleanup — tenant-agnostic delete.
    await db.delete(customers).where(inArray(customers.id, insertedCustomerIds));
  });

  it("GET / returns array shape on empty filter", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Page;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  it("POST / creates a row (201) and GET /:id returns it", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractId: contractIdA,
        aggregatorName: "Acme Energy Brokers",
        aggregatorCommPct: "10.50",
        amount: "1234.56",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; aggregatorName: string };
    expect(created.aggregatorName).toBe("Acme Energy Brokers");

    const getRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${created.id}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { id: string; aggregatorCommPct: string };
    expect(fetched.id).toBe(created.id);
    expect(fetched.aggregatorCommPct).toBe("10.50");
  });

  it("POST / rejects bad body with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        // missing required contractId + aggregatorName
        amount: "100",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST / + GET /?contractId=... + GET /?aggregatorName=... filters", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    // Two rows on contractIdA2 + one on contractIdA, distinct aggregator names.
    const make = (contractId: string, name: string) =>
      SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ contractId, aggregatorName: name }),
      });

    const r1 = await make(contractIdA2, "FilterAggA");
    const r2 = await make(contractIdA2, "FilterAggB");
    const r3 = await make(contractIdA, "FilterAggA");
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r3.status).toBe(201);

    const byContract = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts?contractId=${contractIdA2}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(byContract.status).toBe(200);
    const byContractBody = (await byContract.json()) as Page;
    expect(
      byContractBody.items.every((p) => p.contractId === contractIdA2),
    ).toBe(true);
    expect(byContractBody.items.length).toBeGreaterThanOrEqual(2);

    const byName = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts?aggregatorName=FilterAggB"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(byName.status).toBe(200);
    const byNameBody = (await byName.json()) as Page;
    expect(byNameBody.items.every((p) => p.aggregatorName === "FilterAggB")).toBe(true);
  });

  it("GET / paginates via cursor", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    // Seed 3 rows on a fresh contract to control the page boundary.
    const seed = await seedContract(ids.a);
    insertedCustomerIds.push(seed.customerId);
    const cid = seed.contractId;
    for (let i = 0; i < 3; i++) {
      await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ contractId: cid, aggregatorName: `Page${i}` }),
      });
    }

    const first = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts?contractId=${cid}&limit=2`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    const firstBody = (await first.json()) as Page;
    expect(firstBody.items.length).toBe(2);
    expect(firstBody.nextCursor).toBeTruthy();

    const next = await SELF.fetch(
      url(
        HOST_TENANT_A,
        `/api/aggregator-payouts?contractId=${cid}&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
      ),
      { headers: { authorization: `Bearer ${token}` } },
    );
    const nextBody = (await next.json()) as Page;
    expect(nextBody.items.length).toBe(1);
    expect(nextBody.nextCursor).toBeNull();
  });

  it("GET / rejects malformed cursor with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts?cursor=not-base64"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET /:id with non-uuid path returns 404 NOT_FOUND", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts/not-a-uuid"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id updates fields and returns the row", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractId: contractIdA,
        aggregatorName: "Before",
      }),
    });
    const created = (await createRes.json()) as { id: string };

    const patchRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${created.id}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ aggregatorName: "After", amount: "999.00" }),
      },
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { aggregatorName: string; amount: string };
    expect(patched.aggregatorName).toBe("After");
    expect(patched.amount).toBe("999.00");
  });

  it("PATCH /:id with bad uuid returns 404 NOT_FOUND", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts/not-a-uuid"),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ aggregatorName: "x" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /:id returns 404 for a uuid that doesn't exist", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts/00000000-0000-4000-8000-00000000dead"),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ aggregatorName: "Ghost" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /:id with empty body returns 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractId: contractIdA,
        aggregatorName: "EmptyPatchTarget",
      }),
    });
    const created = (await createRes.json()) as { id: string };
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${created.id}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
  });

  it("PATCH /:id RLS isolation: tenant A cannot patch tenant B row (404)", async () => {
    const ids = await getSeededTenantIds();
    const tokenB = await mintJwt({ tenantId: ids.b });
    // Seed a payout in tenant B via API.
    const createRes = await SELF.fetch(
      url(HOST_TENANT_B, "/api/aggregator-payouts"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${tokenB}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contractId: contractIdB,
          aggregatorName: "TenantB-only",
        }),
      },
    );
    expect(createRes.status).toBe(201);
    const bRow = (await createRes.json()) as { id: string };

    // Tenant A trying to PATCH tenant B's row must see 404 (RLS scoped invisible).
    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${bRow.id}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ aggregatorName: "hijack" }),
      },
    );
    expect(res.status).toBe(404);

    // Tenant B can still see + read the row (sanity check).
    const verify = await SELF.fetch(
      url(HOST_TENANT_B, `/api/aggregator-payouts/${bRow.id}`),
      { headers: { authorization: `Bearer ${tokenB}` } },
    );
    expect(verify.status).toBe(200);
  });

  it("DELETE /:id removes row (204), GET /:id then 404", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/aggregator-payouts"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractId: contractIdA,
        aggregatorName: "ToDelete",
      }),
    });
    const created = (await createRes.json()) as { id: string };

    const delRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${created.id}`),
      { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
    );
    expect(delRes.status).toBe(204);

    const getRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${created.id}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(getRes.status).toBe(404);
  });

  it("DELETE /:id with bad uuid returns 404", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts/not-a-uuid"),
      { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /:id returns 404 for a uuid that doesn't exist", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/aggregator-payouts/00000000-0000-4000-8000-00000000beef"),
      { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /:id RLS isolation: tenant A cannot delete tenant B row (404)", async () => {
    const ids = await getSeededTenantIds();
    const tokenB = await mintJwt({ tenantId: ids.b });
    const createRes = await SELF.fetch(
      url(HOST_TENANT_B, "/api/aggregator-payouts"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${tokenB}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contractId: contractIdB,
          aggregatorName: "TenantB-delete-target",
        }),
      },
    );
    const bRow = (await createRes.json()) as { id: string };

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/aggregator-payouts/${bRow.id}`),
      { method: "DELETE", headers: { authorization: `Bearer ${tokenA}` } },
    );
    expect(res.status).toBe(404);

    // Tenant B's row still there.
    const verify = await SELF.fetch(
      url(HOST_TENANT_B, `/api/aggregator-payouts/${bRow.id}`),
      { headers: { authorization: `Bearer ${tokenB}` } },
    );
    expect(verify.status).toBe(200);
  });
});
