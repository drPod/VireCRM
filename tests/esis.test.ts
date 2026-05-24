import { env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSeededTenantIds, HOST_TENANT_A, HOST_TENANT_B, hasTestDb, mintJwt } from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

// FK chain: ESIs -> service_addresses -> customers. Every ESI test needs a
// service_address row that lives in the same tenant as the JWT we mint.
// Seeded once per describe (test DB is shared across tests in this file) and
// torn down with the inserted ESIs in afterAll.
interface SeedFixture {
  tenantA: string;
  tenantB: string;
  serviceAddressIdA: string;
  serviceAddressIdA2: string; // second address in tenant A for filter assertion
  serviceAddressIdB: string;
  customerIdA: string;
  customerIdB: string;
}

let fixture: SeedFixture | null = null;
const createdEsiIds: string[] = [];

async function seed(): Promise<SeedFixture> {
  if (fixture) return fixture;
  const ids = await getSeededTenantIds();
  const { makeDb } = await import("../workers/db");
  const { customers, serviceAddresses } = await import("../workers/db/schema");
  const { withTenantContext } = await import("../workers/db/with-tenant-context");

  const db = makeDb(env);

  const [aCustomer, aAddr1, aAddr2] = await withTenantContext(db, ids.a, async (tx) => {
    const cust = await tx
      .insert(customers)
      .values({ tenantId: ids.a, name: "esi-test-customer-a" })
      .returning({ id: customers.id });
    const customerId = cust[0]!.id;
    const addr1 = await tx
      .insert(serviceAddresses)
      .values({ tenantId: ids.a, customerId, addressLine1: "100 Main St" })
      .returning({ id: serviceAddresses.id });
    const addr2 = await tx
      .insert(serviceAddresses)
      .values({ tenantId: ids.a, customerId, addressLine1: "200 Main St" })
      .returning({ id: serviceAddresses.id });
    return [customerId, addr1[0]!.id, addr2[0]!.id] as const;
  });

  const [bCustomer, bAddr] = await withTenantContext(db, ids.b, async (tx) => {
    const cust = await tx
      .insert(customers)
      .values({ tenantId: ids.b, name: "esi-test-customer-b" })
      .returning({ id: customers.id });
    const customerId = cust[0]!.id;
    const addr = await tx
      .insert(serviceAddresses)
      .values({ tenantId: ids.b, customerId, addressLine1: "999 B St" })
      .returning({ id: serviceAddresses.id });
    return [customerId, addr[0]!.id] as const;
  });

  fixture = {
    tenantA: ids.a,
    tenantB: ids.b,
    serviceAddressIdA: aAddr1,
    serviceAddressIdA2: aAddr2,
    serviceAddressIdB: bAddr,
    customerIdA: aCustomer,
    customerIdB: bCustomer,
  };
  return fixture;
}

describe.skipIf(!hasTestDb)("ESIs CRUD", () => {
  beforeAll(async () => {
    await seed();
  });

  afterAll(async () => {
    if (!fixture) return;
    const { makeDb } = await import("../workers/db");
    const { customers, serviceAddresses, esis } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    if (createdEsiIds.length > 0) {
      await db.delete(esis).where(inArray(esis.id, createdEsiIds));
    }
    // service_addresses + customers are FK-cascaded — clean by ID for clarity.
    await db
      .delete(serviceAddresses)
      .where(
        inArray(serviceAddresses.id, [
          fixture.serviceAddressIdA,
          fixture.serviceAddressIdA2,
          fixture.serviceAddressIdB,
        ]),
      );
    await db
      .delete(customers)
      .where(inArray(customers.id, [fixture.customerIdA, fixture.customerIdB]));
  });

  // ---- LIST ----

  it("GET /api/esis — returns valid page shape", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  it("GET /api/esis — rejects invalid limit=999 with 400 VALIDATION", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis?limit=999"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET /api/esis?serviceAddressId=<bad-uuid> — 400 VALIDATION", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis?serviceAddressId=not-a-uuid"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET /api/esis?serviceAddressId=<uuid> — filters to that address only", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });

    // Create two ESIs — one on address A, one on address A2.
    const e1 = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        serviceAddressId: fx.serviceAddressIdA,
        esiId: "10443720000000001",
      }),
    });
    expect(e1.status).toBe(201);
    const e1Body = (await e1.json()) as { id: string };
    createdEsiIds.push(e1Body.id);

    const e2 = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        serviceAddressId: fx.serviceAddressIdA2,
        esiId: "10443720000000002",
      }),
    });
    expect(e2.status).toBe(201);
    const e2Body = (await e2.json()) as { id: string };
    createdEsiIds.push(e2Body.id);

    // Filter by serviceAddressIdA — only e1 expected.
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/esis?serviceAddressId=${fx.serviceAddressIdA}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string; serviceAddressId: string }[];
    };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(e1Body.id);
    expect(ids).not.toContain(e2Body.id);
    for (const item of body.items) {
      expect(item.serviceAddressId).toBe(fx.serviceAddressIdA);
    }
  });

  it("GET /api/esis?limit=1 — paginates with non-null cursor when more rows exist", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });

    // Seed 2 esis so a limit-1 page is forced to set a cursor.
    for (let i = 0; i < 2; i++) {
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          serviceAddressId: fx.serviceAddressIdA,
          esiId: `10443729999900${100 + i}`,
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string };
      createdEsiIds.push(body.id);
    }

    const page1 = await SELF.fetch(url(HOST_TENANT_A, "/api/esis?limit=1"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page1.status).toBe(200);
    const body1 = (await page1.json()) as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    expect(body1.items.length).toBe(1);
    expect(body1.nextCursor).not.toBeNull();

    const page2 = await SELF.fetch(
      url(HOST_TENANT_A, `/api/esis?limit=1&cursor=${body1.nextCursor}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(page2.status).toBe(200);
    const body2 = (await page2.json()) as {
      items: { id: string }[];
    };
    expect(body2.items.length).toBeGreaterThanOrEqual(1);
    expect(body2.items[0]!.id).not.toBe(body1.items[0]!.id);
  });

  it("GET /api/esis?cursor=garbage — 400 VALIDATION", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis?cursor=%21%21not-base64%21%21"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  // ---- GET BY ID ----

  it("GET /api/esis/:id — 404 on malformed UUID", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis/not-a-uuid"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("GET /api/esis/:id — 404 on missing UUID", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/esis/00000000-0000-4000-8000-000000000abc"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
  });

  // ---- CREATE ----

  it("POST /api/esis — 201, esiId and physicalMeterSerial round-trip as DISTINCT fields", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });

    // Domain invariant: ESI ID (canonical, xlsx "Meter Number") and Physical
    // Meter Serial (xlsx "Meter Id") are DIFFERENT. ESI ID is the TX-energy
    // universal key tied to the service address; Physical Meter Serial is the
    // device serial that changes on meter swap. They must never collapse.
    const ESI_ID = "10443720123456789";
    const METER_SERIAL = "MTR-SN-77777";

    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        serviceAddressId: fx.serviceAddressIdA,
        esiId: ESI_ID,
        physicalMeterSerial: METER_SERIAL,
        eacKwh: "12345.6789",
        billingAqKwh: "11000.0000",
        annualUsageKwh: "11500.5000",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      id: string;
      esiId: string;
      physicalMeterSerial: string | null;
      serviceAddressId: string;
      eacKwh: string | null;
      billingAqKwh: string | null;
      annualUsageKwh: string | null;
    };
    createdEsiIds.push(created.id);

    expect(created.esiId).toBe(ESI_ID);
    expect(created.physicalMeterSerial).toBe(METER_SERIAL);
    // Never collapse — explicit non-equality check on top of value equality.
    expect(created.esiId).not.toBe(created.physicalMeterSerial);
    expect(created.serviceAddressId).toBe(fx.serviceAddressIdA);

    const getRes = await SELF.fetch(url(HOST_TENANT_A, `/api/esis/${created.id}`), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as {
      esiId: string;
      physicalMeterSerial: string | null;
    };
    expect(fetched.esiId).toBe(ESI_ID);
    expect(fetched.physicalMeterSerial).toBe(METER_SERIAL);
  });

  it("POST /api/esis — 400 on missing required fields", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ serviceAddressId: fx.serviceAddressIdA }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST /api/esis — 400 on bad serviceAddressId UUID", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        serviceAddressId: "not-a-uuid",
        esiId: "1044372ABCDEFGHIJ",
      }),
    });
    expect(res.status).toBe(400);
  });

  // ---- PATCH ----

  it("PATCH /api/esis/:id — 200 updates fields", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });

    const create = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        serviceAddressId: fx.serviceAddressIdA,
        esiId: "10443720000000777",
        physicalMeterSerial: "MTR-ORIG",
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string };
    createdEsiIds.push(created.id);

    const patch = await SELF.fetch(url(HOST_TENANT_A, `/api/esis/${created.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        physicalMeterSerial: "MTR-SWAPPED",
        eacKwh: "9999.0000",
      }),
    });
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as {
      esiId: string;
      physicalMeterSerial: string | null;
      eacKwh: string | null;
    };
    expect(updated.esiId).toBe("10443720000000777"); // unchanged
    expect(updated.physicalMeterSerial).toBe("MTR-SWAPPED");
    expect(updated.eacKwh).toBe("9999.0000");
  });

  it("PATCH /api/esis/:id — 404 on missing UUID", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/esis/00000000-0000-4000-8000-000000000def"),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ physicalMeterSerial: "MTR-X" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /api/esis/:id — 404 on malformed UUID", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis/not-a-uuid"), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ physicalMeterSerial: "MTR-X" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/esis/:id — RLS isolation, tenant A cannot patch tenant B row", async () => {
    const fx = await seed();
    const { makeDb } = await import("../workers/db");
    const { esis } = await import("../workers/db/schema");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");

    // Seed an ESI in tenant B.
    const db = makeDb(env);
    const bRow = await withTenantContext(db, fx.tenantB, async (tx) => {
      const out = await tx
        .insert(esis)
        .values({
          tenantId: fx.tenantB,
          serviceAddressId: fx.serviceAddressIdB,
          esiId: "RLS-LEAK-TARGET-PATCH",
        })
        .returning({ id: esis.id });
      return out[0]!;
    });
    createdEsiIds.push(bRow.id);

    // Tenant A JWT trying to PATCH tenant B's row -> 404 (RLS hides the row).
    const tokenA = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/esis/${bRow.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${tokenA}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ physicalMeterSerial: "MTR-LEAK" }),
    });
    expect(res.status).toBe(404);

    // Tenant B JWT can still patch — proves the seed worked.
    const tokenB = await mintJwt({ tenantId: fx.tenantB });
    const resB = await SELF.fetch(url(HOST_TENANT_B, `/api/esis/${bRow.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${tokenB}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ physicalMeterSerial: "MTR-OK" }),
    });
    expect(resB.status).toBe(200);
  });

  // ---- DELETE ----

  it("DELETE /api/esis/:id — 204 then 404 on second call", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });

    const create = await SELF.fetch(url(HOST_TENANT_A, "/api/esis"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        serviceAddressId: fx.serviceAddressIdA,
        esiId: "10443720000000888",
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string };

    const del = await SELF.fetch(url(HOST_TENANT_A, `/api/esis/${created.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);

    const del2 = await SELF.fetch(url(HOST_TENANT_A, `/api/esis/${created.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del2.status).toBe(404);
  });

  it("DELETE /api/esis/:id — 404 on malformed UUID", async () => {
    const fx = await seed();
    const token = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/esis/not-a-uuid"), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/esis/:id — RLS isolation, tenant A cannot delete tenant B row", async () => {
    const fx = await seed();
    const { makeDb } = await import("../workers/db");
    const { esis } = await import("../workers/db/schema");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");

    const db = makeDb(env);
    const bRow = await withTenantContext(db, fx.tenantB, async (tx) => {
      const out = await tx
        .insert(esis)
        .values({
          tenantId: fx.tenantB,
          serviceAddressId: fx.serviceAddressIdB,
          esiId: "RLS-LEAK-TARGET-DELETE",
        })
        .returning({ id: esis.id });
      return out[0]!;
    });
    createdEsiIds.push(bRow.id);

    const tokenA = await mintJwt({ tenantId: fx.tenantA });
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/esis/${bRow.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(404);

    // Tenant B JWT can read it — proves the seed survived the leak attempt.
    const tokenB = await mintJwt({ tenantId: fx.tenantB });
    const resB = await SELF.fetch(url(HOST_TENANT_B, `/api/esis/${bRow.id}`), {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(resB.status).toBe(200);
  });
});
