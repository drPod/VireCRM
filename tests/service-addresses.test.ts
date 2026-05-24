import { env, SELF } from "cloudflare:test";
import { afterAll, describe, expect, it } from "vitest";
import { getSeededTenantIds, HOST_TENANT_A, HOST_TENANT_B, hasTestDb, mintJwt } from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

interface ServiceAddressRow {
  id: string;
  customerId: string;
  streetName: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  createdAt: string;
}

interface ListBody {
  items: ServiceAddressRow[];
  nextCursor: string | null;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

describe.skipIf(!hasTestDb)("/api/service-addresses (CRUD)", () => {
  // Track everything we insert across both tenants so the afterAll teardown
  // doesn't leave row droppings in shared test tenants. Customer rows are
  // cascaded into service-addresses via FK on delete, but we delete addresses
  // first so test isolation doesn't depend on cascade order.
  const insertedAddressIds: string[] = [];
  const insertedCustomerIds: string[] = [];

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { customers, serviceAddresses } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    if (insertedAddressIds.length > 0) {
      await db.delete(serviceAddresses).where(inArray(serviceAddresses.id, insertedAddressIds));
    }
    if (insertedCustomerIds.length > 0) {
      await db.delete(customers).where(inArray(customers.id, insertedCustomerIds));
    }
  });

  async function seedCustomer(tenantId: string, name = "sa-test-cust") {
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");
    const db = makeDb(env);
    const row = await withTenantContext(db, tenantId, async (tx) => {
      const out = await tx
        .insert(customers)
        .values({ tenantId, name })
        .returning({ id: customers.id });
      return out[0]!;
    });
    insertedCustomerIds.push(row.id);
    return row.id;
  }

  it("GET / returns shaped page for tenant with no addresses (or some)", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  it("POST creates, GET returns it, GET ?customerId scopes, PATCH updates, DELETE removes", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const customerId = await seedCustomer(ids.a, "sa-crud-cust");

    // POST → 201
    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId,
        streetName: "Congress Ave",
        city: "Austin",
        state: "TX",
        zip: "78701",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as ServiceAddressRow;
    expect(created.customerId).toBe(customerId);
    expect(created.streetName).toBe("Congress Ave");
    expect(created.city).toBe("Austin");
    insertedAddressIds.push(created.id);

    // GET /:id
    const getRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${created.id}`), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as ServiceAddressRow;
    expect(fetched.id).toBe(created.id);

    // GET ?customerId= scopes to that customer
    const listRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/service-addresses?customerId=${customerId}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as ListBody;
    expect(listBody.items.some((r) => r.id === created.id)).toBe(true);
    // Every item in a scoped query must belong to that customer — proves the
    // filter isn't being silently dropped.
    for (const item of listBody.items) {
      expect(item.customerId).toBe(customerId);
    }

    // PATCH
    const patchRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${created.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ city: "Houston" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as ServiceAddressRow;
    expect(patched.city).toBe("Houston");
    expect(patched.streetName).toBe("Congress Ave");

    // DELETE
    const delRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${created.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.status).toBe(204);

    // Re-fetch after delete → 404
    const getAfterDel = await SELF.fetch(
      url(HOST_TENANT_A, `/api/service-addresses/${created.id}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(getAfterDel.status).toBe(404);
  });

  it("GET / cursor paginates", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const customerId = await seedCustomer(ids.a, "sa-pag-cust");

    // Seed 3 addresses, then list with limit=2.
    const made: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ customerId, streetName: `Row ${i}` }),
      });
      expect(res.status).toBe(201);
      const row = (await res.json()) as ServiceAddressRow;
      made.push(row.id);
      insertedAddressIds.push(row.id);
    }

    const firstPage = await SELF.fetch(
      url(HOST_TENANT_A, `/api/service-addresses?limit=2&customerId=${customerId}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(firstPage.status).toBe(200);
    const firstBody = (await firstPage.json()) as ListBody;
    expect(firstBody.items.length).toBe(2);
    expect(firstBody.nextCursor).toBeTruthy();

    const secondPage = await SELF.fetch(
      url(
        HOST_TENANT_A,
        `/api/service-addresses?limit=2&customerId=${customerId}&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
      ),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(secondPage.status).toBe(200);
    const secondBody = (await secondPage.json()) as ListBody;
    expect(secondBody.items.length).toBe(1);
    // No row leaks between pages.
    const firstIds = new Set(firstBody.items.map((r) => r.id));
    for (const row of secondBody.items) {
      expect(firstIds.has(row.id)).toBe(false);
    }
  });

  it("POST rejects body without customerId with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ city: "Austin" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET / rejects malformed customerId filter with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/service-addresses?customerId=not-a-uuid"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET /:id returns 404 NOT_FOUND on malformed UUID", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses/not-a-uuid"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("PATCH returns 404 for missing id", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const missingId = "00000000-0000-4000-8000-000000000999";
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${missingId}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ city: "Dallas" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("DELETE returns 404 for missing id", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const missingId = "00000000-0000-4000-8000-000000000998";
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${missingId}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("RLS isolation: tenant-A JWT cannot GET / PATCH / DELETE tenant-B address (404, not 403)", async () => {
    const ids = await getSeededTenantIds();
    // Seed in B directly via DB (not via Worker, since the Worker is scoped to
    // tenant A on tenant-A subdomain).
    const tokenB = await mintJwt({ tenantId: ids.b });
    const customerIdB = await seedCustomer(ids.b, "sa-rls-cust-b");

    const createB = await SELF.fetch(url(HOST_TENANT_B, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenB}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerId: customerIdB, city: "Houston" }),
    });
    expect(createB.status).toBe(201);
    const bRow = (await createB.json()) as ServiceAddressRow;
    insertedAddressIds.push(bRow.id);

    const tokenA = await mintJwt({ tenantId: ids.a });
    // Cross-tenant GET — must 404, not 403, so the row's existence isn't
    // leaked via status-code distinction.
    const getRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${bRow.id}`), {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(getRes.status).toBe(404);

    // Cross-tenant PATCH — must also 404.
    const patchRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${bRow.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${tokenA}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ city: "Austin" }),
    });
    expect(patchRes.status).toBe(404);

    // Cross-tenant DELETE — must also 404.
    const delRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${bRow.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(delRes.status).toBe(404);

    // Tenant B can still see + delete its own row → proves RLS isn't
    // blocking everything by accident.
    const okRes = await SELF.fetch(url(HOST_TENANT_B, `/api/service-addresses/${bRow.id}`), {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(okRes.status).toBe(200);
  });

  it("POST rejects cross-tenant customerId with 404 (no row written)", async () => {
    // Postgres FK enforcement bypasses RLS (runs as table owner). Without an
    // explicit in-tenant existence check, a tenant-A JWT could attach a
    // service address to a tenant-B customer row — the FK alone wouldn't stop
    // it. createServiceAddress now does a tenant-scoped SELECT inside the
    // same tx; this test proves the leak is closed.
    const ids = await getSeededTenantIds();
    const tokenA = await mintJwt({ tenantId: ids.a });
    const customerIdB = await seedCustomer(ids.b, "sa-fk-leak-cust-b");

    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenA}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerId: customerIdB, city: "Austin" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe("NOT_FOUND");

    // Confirm no row was written under tenant A pointing at B's customer.
    const { makeDb } = await import("../workers/db");
    const { serviceAddresses } = await import("../workers/db/schema");
    const { and: dAnd, eq: dEq } = await import("drizzle-orm");
    const db = makeDb(env);
    const leaked = await db
      .select({ id: serviceAddresses.id })
      .from(serviceAddresses)
      .where(
        dAnd(
          dEq(serviceAddresses.tenantId, ids.a),
          dEq(serviceAddresses.customerId, customerIdB),
        ),
      );
    expect(leaked.length).toBe(0);
  });

  it("PATCH rejects empty body with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const customerId = await seedCustomer(ids.a, "sa-empty-patch-cust");

    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerId, city: "Austin" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as ServiceAddressRow;
    insertedAddressIds.push(created.id);

    const patchRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${created.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(patchRes.status).toBe(400);
    const body = (await patchRes.json()) as ErrorBody;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST rejects unknown keys with 400 VALIDATION (strict schema)", async () => {
    // Without `.strict()`, server-managed fields like `tenantId`/`id`/
    // `createdAt` would be silently stripped — callers couldn't tell their
    // payload was wrong, and a future code path that forgot to destructure
    // could leak them into the insert.
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const customerId = await seedCustomer(ids.a, "sa-strict-cust");

    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId,
        city: "Austin",
        tenantId: ids.b,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("PATCH rejects unknown keys with 400 VALIDATION (strict schema)", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const customerId = await seedCustomer(ids.a, "sa-strict-patch-cust");

    const createRes = await SELF.fetch(url(HOST_TENANT_A, "/api/service-addresses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerId, city: "Austin" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as ServiceAddressRow;
    insertedAddressIds.push(created.id);

    const patchRes = await SELF.fetch(url(HOST_TENANT_A, `/api/service-addresses/${created.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ city: "Houston", id: created.id }),
    });
    expect(patchRes.status).toBe(400);
    const body = (await patchRes.json()) as ErrorBody;
    expect(body.error?.code).toBe("VALIDATION");
  });
});
