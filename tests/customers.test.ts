import { SELF, env } from "cloudflare:test";
import { afterAll, describe, expect, it } from "vitest";
import { HOST_TENANT_A, getSeededTenantIds, hasTestDb, mintJwt } from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

describe.skipIf(!hasTestDb)("GET /api/customers", () => {
  const insertedIds: string[] = [];

  afterAll(async () => {
    if (insertedIds.length === 0) return;
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    await db.delete(customers).where(inArray(customers.id, insertedIds));
  });

  it("returns empty page for tenant with no customers", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/customers"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; nextCursor: string | null };
    // Don't assert items === []; another test may have inserted into tenant A.
    // Only assert that the response shape is correct.
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  it("rejects invalid limit=999 with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/customers?limit=999"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("RLS isolation: tenant-A JWT cannot fetch tenant-B row by id (404, not 403)", async () => {
    const ids = await getSeededTenantIds();
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");

    // Seed a customer in tenant B with tenant context set.
    const db = makeDb(env);
    const bRow = await withTenantContext(db, ids.b, async (tx) => {
      const out = await tx
        .insert(customers)
        .values({
          tenantId: ids.b,
          name: "rls-leak-target",
        })
        .returning({ id: customers.id });
      return out[0]!;
    });
    insertedIds.push(bRow.id);

    // Tenant A JWT fetching tenant B's customer by id must see 404.
    // 403 would leak that the row exists; the RLS policy makes the row
    // invisible, so the handler legitimately returns "not found".
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/customers/${bRow.id}`), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");

    // Tenant B JWT MUST be able to read the row — proves the seed worked
    // and we're not just blocking everything by accident.
    const tokenB = await mintJwt({ tenantId: ids.b });
    const resB = await SELF.fetch(url("testbravo.virecrm.com", `/api/customers/${bRow.id}`), {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(resB.status).toBe(200);
  });
});

describe.skipIf(!hasTestDb)("customers mutations", () => {
  const insertedIds: string[] = [];

  afterAll(async () => {
    if (insertedIds.length === 0) return;
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    await db.delete(customers).where(inArray(customers.id, insertedIds));
  });

  // Local fetch helper — same Worker, same token shape, just trims the noise.
  // Returns the raw Response so the caller can branch on status + read body.
  async function callApi(
    token: string,
    method: string,
    path: string,
    body?: unknown,
    host: string = HOST_TENANT_A,
  ): Promise<Response> {
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    };
    return SELF.fetch(url(host, path), init);
  }

  // Direct-seed a customer in `tenantId` via tenant context — used for the
  // cross-tenant tests where the row must NOT be reachable through tenant A's
  // own POST handler.
  async function seedCustomer(tenantId: string, name: string): Promise<string> {
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
    insertedIds.push(row.id);
    return row.id;
  }

  it("POST / creates a customer (201 + list-item shape)", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await callApi(token, "POST", "/api/customers", {
      name: "POST-create-target",
      primaryEmail: "post-create@example.com",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      externalCustomerId: string | null;
      primaryContactName: string | null;
      primaryEmail: string | null;
      primaryPhone: string | null;
      createdAt: string;
    };
    expect(typeof body.id).toBe("string");
    expect(body.name).toBe("POST-create-target");
    expect(body.primaryEmail).toBe("post-create@example.com");
    // List-item shape: no `tenantId` exposed.
    expect("tenantId" in body).toBe(false);
    expect(typeof body.createdAt).toBe("string");
    insertedIds.push(body.id);
  });

  it("POST / missing `name` → 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await callApi(token, "POST", "/api/customers", {
      primaryEmail: "no-name@example.com",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("PATCH /:id updates fields → 200 + updated row", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    const createRes = await callApi(token, "POST", "/api/customers", {
      name: "PATCH-target-original",
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    insertedIds.push(created.id);

    const patchRes = await callApi(token, "PATCH", `/api/customers/${created.id}`, {
      name: "PATCH-target-updated",
      primaryPhone: "+15555550123",
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      id: string;
      name: string;
      primaryPhone: string | null;
    };
    expect(patched.id).toBe(created.id);
    expect(patched.name).toBe("PATCH-target-updated");
    expect(patched.primaryPhone).toBe("+15555550123");
  });

  it("PATCH /:id cross-tenant → 404 (RLS isolation)", async () => {
    const ids = await getSeededTenantIds();
    const bId = await seedCustomer(ids.b, "patch-cross-tenant-target");

    const token = await mintJwt({ tenantId: ids.a });
    const res = await callApi(token, "PATCH", `/api/customers/${bId}`, {
      name: "should-not-apply",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id malformed UUID → 404 NOT_FOUND", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await callApi(token, "PATCH", "/api/customers/not-a-uuid", {
      name: "x",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("DELETE /:id removes the row → 204 + subsequent GET → 404", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    const createRes = await callApi(token, "POST", "/api/customers", {
      name: "DELETE-target",
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };

    const delRes = await callApi(token, "DELETE", `/api/customers/${created.id}`);
    expect(delRes.status).toBe(204);
    expect(await delRes.text()).toBe("");

    const getRes = await callApi(token, "GET", `/api/customers/${created.id}`);
    expect(getRes.status).toBe(404);
    const body = (await getRes.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("DELETE /:id cross-tenant → 404", async () => {
    const ids = await getSeededTenantIds();
    const bId = await seedCustomer(ids.b, "delete-cross-tenant-target");

    const token = await mintJwt({ tenantId: ids.a });
    const res = await callApi(token, "DELETE", `/api/customers/${bId}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");

    // Confirm tenant B's row still exists (DELETE was a true no-op, not just
    // a hidden side-effect masked by RLS).
    const tokenB = await mintJwt({ tenantId: ids.b });
    const getB = await callApi(
      tokenB,
      "GET",
      `/api/customers/${bId}`,
      undefined,
      "testbravo.virecrm.com",
    );
    expect(getB.status).toBe(200);
  });
});
