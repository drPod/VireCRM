import { env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSeededTenantIds, HOST_TENANT_A, HOST_TENANT_B, hasTestDb, mintJwt } from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

interface LoaRow {
  id: string;
  customerId: string;
  pdfStoragePath: string | null;
  signedDate: string | null;
  expirationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: LoaRow[];
  nextCursor: string | null;
}

interface ErrorResponse {
  error?: { code?: string };
}

// Single customer per tenant for the whole suite — FK target for LOA rows.
// Created in beforeAll, cascade-deleted in afterAll (which also wipes any LOAs).
async function seedCustomer(tenantId: string, name: string): Promise<string> {
  const { makeDb } = await import("../workers/db");
  const { customers } = await import("../workers/db/schema");
  const { withTenantContext } = await import("../workers/db/with-tenant-context");
  const db = makeDb(env);
  return withTenantContext(db, tenantId, async (tx) => {
    const out = await tx
      .insert(customers)
      .values({ tenantId, name })
      .returning({ id: customers.id });
    const row = out[0];
    if (!row) throw new Error("seedCustomer: no row returned");
    return row.id;
  });
}

describe.skipIf(!hasTestDb)("LOAs CRUD", () => {
  let customerA = "";
  let customerB = "";
  const seededCustomerIds: string[] = [];

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    customerA = await seedCustomer(ids.a, "loa-test-customer-a");
    customerB = await seedCustomer(ids.b, "loa-test-customer-b");
    seededCustomerIds.push(customerA, customerB);
  });

  afterAll(async () => {
    if (seededCustomerIds.length === 0) return;
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    // Customer delete cascades to LOAs (FK onDelete: cascade).
    await db.delete(customers).where(inArray(customers.id, seededCustomerIds));
  });

  async function authedFetch(
    host: string,
    path: string,
    tenantId: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const token = await mintJwt({ tenantId });
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return SELF.fetch(url(host, path), { ...init, headers });
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  it("GET / returns a page-shaped response", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  it("GET / rejects limit=999 with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas?limit=999", ids.a);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET / rejects malformed cursor with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas?cursor=not-base64-json", ids.a);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET / rejects malformed customerId with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas?customerId=not-a-uuid", ids.a);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  // ---------------------------------------------------------------------------
  // POST + GET by id
  // ---------------------------------------------------------------------------

  it("POST / creates with all fields → 201 and GET /:id returns it", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({
        customerId: customerA,
        pdfStoragePath: "loas/tenant-a/contract-001.pdf",
        signedDate: "2025-01-15",
        expirationDate: "2026-01-15",
      }),
    });
    expect(res.status).toBe(201);
    const row = (await res.json()) as LoaRow;
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.customerId).toBe(customerA);
    expect(row.pdfStoragePath).toBe("loas/tenant-a/contract-001.pdf");
    expect(row.signedDate).toBe("2025-01-15");
    expect(row.expirationDate).toBe("2026-01-15");

    const getRes = await authedFetch(HOST_TENANT_A, `/api/loas/${row.id}`, ids.a);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as LoaRow;
    expect(fetched.id).toBe(row.id);
  });

  it("POST / rejects missing customerId with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({
        pdfStoragePath: "loas/whatever.pdf",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST / rejects malformed customerId with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({ customerId: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST / unknown (cross-tenant) customerId → 400 VALIDATION", async () => {
    // Tenant A trying to attach an LOA to tenant B's customer. RLS makes
    // the FK target invisible, FK violation surfaces as 400.
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({ customerId: customerB }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST / rejects invalid JSON body with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/loas"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("VALIDATION");
  });

  // ---------------------------------------------------------------------------
  // LIST with ?customerId= filter + cursor pagination
  // ---------------------------------------------------------------------------

  it("GET /?customerId= filters to a single customer", async () => {
    const ids = await getSeededTenantIds();

    // Seed one extra LOA against customerA so we have ≥2 to assert against.
    const create = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({
        customerId: customerA,
        pdfStoragePath: "loas/filter-test.pdf",
      }),
    });
    expect(create.status).toBe(201);

    const res = await authedFetch(HOST_TENANT_A, `/api/loas?customerId=${customerA}`, ids.a);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListResponse;
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.customerId).toBe(customerA);
    }
  });

  it("GET / with cursor walks the page boundary correctly", async () => {
    const ids = await getSeededTenantIds();

    // Force a multi-page state: insert 3 rows for customerA, request limit=1.
    for (let i = 0; i < 3; i++) {
      const res = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
        method: "POST",
        body: JSON.stringify({
          customerId: customerA,
          pdfStoragePath: `loas/cursor-${i}.pdf`,
        }),
      });
      expect(res.status).toBe(201);
    }

    const first = await authedFetch(
      HOST_TENANT_A,
      `/api/loas?customerId=${customerA}&limit=1`,
      ids.a,
    );
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as ListResponse;
    expect(firstBody.items.length).toBe(1);
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await authedFetch(
      HOST_TENANT_A,
      `/api/loas?customerId=${customerA}&limit=1&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
      ids.a,
    );
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as ListResponse;
    expect(secondBody.items.length).toBe(1);
    // Cursor must advance past the first page's last item.
    expect(secondBody.items[0]!.id).not.toBe(firstBody.items[0]!.id);
  });

  // ---------------------------------------------------------------------------
  // GET /:id edge cases
  // ---------------------------------------------------------------------------

  it("GET /:id returns 404 for unknown UUID", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(
      HOST_TENANT_A,
      "/api/loas/00000000-0000-4000-8000-deadbeef0000",
      ids.a,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("GET /:id returns 404 for malformed UUID (not 400 — hides shape)", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas/not-a-uuid", ids.a);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  // ---------------------------------------------------------------------------
  // PATCH
  // ---------------------------------------------------------------------------

  it("PATCH /:id updates partial fields and returns the row", async () => {
    const ids = await getSeededTenantIds();
    const create = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({
        customerId: customerA,
        pdfStoragePath: "loas/before.pdf",
        signedDate: "2025-03-01",
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as LoaRow;

    const patch = await authedFetch(HOST_TENANT_A, `/api/loas/${created.id}`, ids.a, {
      method: "PATCH",
      body: JSON.stringify({
        pdfStoragePath: "loas/after.pdf",
        expirationDate: "2026-03-01",
      }),
    });
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as LoaRow;
    expect(updated.id).toBe(created.id);
    expect(updated.pdfStoragePath).toBe("loas/after.pdf");
    expect(updated.signedDate).toBe("2025-03-01"); // untouched
    expect(updated.expirationDate).toBe("2026-03-01");
  });

  it("PATCH /:id can null out a field by sending null", async () => {
    const ids = await getSeededTenantIds();
    const create = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({
        customerId: customerA,
        pdfStoragePath: "loas/will-be-cleared.pdf",
      }),
    });
    const created = (await create.json()) as LoaRow;

    const patch = await authedFetch(HOST_TENANT_A, `/api/loas/${created.id}`, ids.a, {
      method: "PATCH",
      body: JSON.stringify({ pdfStoragePath: null }),
    });
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as LoaRow;
    expect(updated.pdfStoragePath).toBeNull();
  });

  it("PATCH /:id returns 404 for unknown UUID", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(
      HOST_TENANT_A,
      "/api/loas/00000000-0000-4000-8000-deadbeef0001",
      ids.a,
      { method: "PATCH", body: JSON.stringify({ pdfStoragePath: "loas/x.pdf" }) },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id returns 404 for malformed UUID", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas/garbage", ids.a, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /:id RLS isolation: tenant A cannot patch tenant B's LOA → 404", async () => {
    const ids = await getSeededTenantIds();

    // Create an LOA as tenant B.
    const createB = await authedFetch(HOST_TENANT_B, "/api/loas", ids.b, {
      method: "POST",
      body: JSON.stringify({
        customerId: customerB,
        pdfStoragePath: "loas/b-only.pdf",
      }),
    });
    expect(createB.status).toBe(201);
    const bRow = (await createB.json()) as LoaRow;

    // Tenant A tries to patch — RLS makes the row invisible → 404.
    const patch = await authedFetch(HOST_TENANT_A, `/api/loas/${bRow.id}`, ids.a, {
      method: "PATCH",
      body: JSON.stringify({ pdfStoragePath: "loas/hacked.pdf" }),
    });
    expect(patch.status).toBe(404);
    const body = (await patch.json()) as ErrorResponse;
    expect(body.error?.code).toBe("NOT_FOUND");

    // Tenant B can still see + update its own row → seed isn't broken.
    const ok = await authedFetch(HOST_TENANT_B, `/api/loas/${bRow.id}`, ids.b);
    expect(ok.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  it("DELETE /:id removes the row → 204, follow-up GET → 404", async () => {
    const ids = await getSeededTenantIds();
    const create = await authedFetch(HOST_TENANT_A, "/api/loas", ids.a, {
      method: "POST",
      body: JSON.stringify({ customerId: customerA }),
    });
    const created = (await create.json()) as LoaRow;

    const del = await authedFetch(HOST_TENANT_A, `/api/loas/${created.id}`, ids.a, {
      method: "DELETE",
    });
    expect(del.status).toBe(204);

    const after = await authedFetch(HOST_TENANT_A, `/api/loas/${created.id}`, ids.a);
    expect(after.status).toBe(404);
  });

  it("DELETE /:id returns 404 for unknown UUID", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(
      HOST_TENANT_A,
      "/api/loas/00000000-0000-4000-8000-deadbeef0002",
      ids.a,
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /:id returns 404 for malformed UUID", async () => {
    const ids = await getSeededTenantIds();
    const res = await authedFetch(HOST_TENANT_A, "/api/loas/garbage", ids.a, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /:id RLS isolation: tenant A cannot delete tenant B's LOA → 404", async () => {
    const ids = await getSeededTenantIds();
    const createB = await authedFetch(HOST_TENANT_B, "/api/loas", ids.b, {
      method: "POST",
      body: JSON.stringify({ customerId: customerB }),
    });
    const bRow = (await createB.json()) as LoaRow;

    const del = await authedFetch(HOST_TENANT_A, `/api/loas/${bRow.id}`, ids.a, {
      method: "DELETE",
    });
    expect(del.status).toBe(404);

    // Tenant B can still see the row.
    const ok = await authedFetch(HOST_TENANT_B, `/api/loas/${bRow.id}`, ids.b);
    expect(ok.status).toBe(200);
  });
});
