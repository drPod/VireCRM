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

interface DealRow {
  id: string;
  customerId: string;
  primaryAgentId: string | null;
  secondaryAgentId: string | null;
  contractId: string | null;
  name: string | null;
  externalSaleId: string | null;
  saleDate: string | null;
  stage: string;
  saleStatus: string | null;
  objectionStatus: string | null;
  objectionType: string | null;
  sourceOfLead: string | null;
  createdAt: string;
}

interface DealsPage {
  items: DealRow[];
  nextCursor: string | null;
}

describe.skipIf(!hasTestDb)("/api/deals CRUD", () => {
  let tenantAId: string;
  let tenantBId: string;
  // Tenant A fixtures (created in beforeAll, used across tests).
  let customerA: string;
  let primaryAgentA: string;
  let secondaryAgentA: string;
  let altCustomerA: string;
  // Track everything we insert so cleanup is exhaustive.
  const dealIds: string[] = [];
  const customerIds: string[] = [];
  const agentIds: string[] = [];

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    tenantAId = ids.a;
    tenantBId = ids.b;

    const { makeDb } = await import("../workers/db");
    const { customers, agents } = await import("../workers/db/schema");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );
    const db = makeDb(env);

    await withTenantContext(db, tenantAId, async (tx) => {
      const [cust] = await tx
        .insert(customers)
        .values({ tenantId: tenantAId, name: "deals-test-customer-primary" })
        .returning({ id: customers.id });
      const [altCust] = await tx
        .insert(customers)
        .values({ tenantId: tenantAId, name: "deals-test-customer-alt" })
        .returning({ id: customers.id });
      const [pri] = await tx
        .insert(agents)
        .values({ tenantId: tenantAId, name: "deals-test-primary-agent" })
        .returning({ id: agents.id });
      const [sec] = await tx
        .insert(agents)
        .values({ tenantId: tenantAId, name: "deals-test-secondary-agent" })
        .returning({ id: agents.id });
      customerA = cust!.id;
      altCustomerA = altCust!.id;
      primaryAgentA = pri!.id;
      secondaryAgentA = sec!.id;
    });
    customerIds.push(customerA, altCustomerA);
    agentIds.push(primaryAgentA, secondaryAgentA);
  });

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { deals, customers, agents } = await import(
      "../workers/db/schema"
    );
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    // Run as `postgres` (BYPASSRLS) so cleanup spans both tenants in one shot.
    // `deals.customer_id` is `ON DELETE CASCADE` so wiping customers would
    // also drop deals — we still delete deals first to make the cleanup
    // explicit (and to no-op safely if the cascade order ever changes).
    if (dealIds.length > 0) {
      await db.delete(deals).where(inArray(deals.id, dealIds));
    }
    if (customerIds.length > 0) {
      await db.delete(customers).where(inArray(customers.id, customerIds));
    }
    if (agentIds.length > 0) {
      await db.delete(agents).where(inArray(agents.id, agentIds));
    }
  });

  // ---------- POST ----------

  it("POST 201 round-trips both primary + secondary agent IDs", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        secondaryAgentId: secondaryAgentA,
        name: "dual-agent deal",
        stage: "In Pricing",
        saleStatus: "Pending",
      }),
    });
    expect(res.status).toBe(201);
    const row = (await res.json()) as DealRow;
    dealIds.push(row.id);
    expect(row.primaryAgentId).toBe(primaryAgentA);
    expect(row.secondaryAgentId).toBe(secondaryAgentA);
    expect(row.customerId).toBe(customerA);
    expect(row.stage).toBe("In Pricing");
    expect(row.saleStatus).toBe("Pending");
  });

  it("POST 201 with only primaryAgentId returns null secondaryAgentId", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        name: "solo-primary deal",
      }),
    });
    expect(res.status).toBe(201);
    const row = (await res.json()) as DealRow;
    dealIds.push(row.id);
    expect(row.primaryAgentId).toBe(primaryAgentA);
    expect(row.secondaryAgentId).toBeNull();
  });

  it("POST 400 VALIDATION when primaryAgentId missing", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerId: customerA, name: "no-primary" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST 400 VALIDATION when customerId malformed", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: "not-a-uuid",
        primaryAgentId: primaryAgentA,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  // ---------- GET ----------

  it("GET / returns at least the deals we just created with valid shape", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
    // Smoke: the deals we inserted should be visible to tenant A.
    expect(body.items.some((d) => dealIds.includes(d.id))).toBe(true);
  });

  it("GET /:id by valid id returns the row", async () => {
    expect(dealIds[0]).toBeDefined();
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealIds[0]}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const row = (await res.json()) as DealRow;
    expect(row.id).toBe(dealIds[0]);
  });

  it("GET /:id malformed UUID returns 404", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals/not-a-uuid"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("GET /:id unknown UUID returns 404", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals/00000000-0000-4000-8000-000000099999"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
  });

  // ---------- LIST (empty + cursor + filters) ----------

  it("GET / for tenant B with no deals returns empty page shape", async () => {
    const tokenB = await mintJwt({ tenantId: tenantBId });
    const res = await SELF.fetch(url(HOST_TENANT_B, "/api/deals"), {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(Array.isArray(body.items)).toBe(true);
    // Tenant B should not see tenant A deals.
    expect(body.items.every((d) => !dealIds.includes(d.id))).toBe(true);
  });

  it("GET / honors limit=1 + cursor pagination", async () => {
    // Preceding POST tests insert ≥2 deals for tenant A — limit=1 MUST
    // return a non-null cursor and the second page MUST be a different row.
    expect(dealIds.length).toBeGreaterThanOrEqual(2);
    const token = await mintJwt({ tenantId: tenantAId });
    const r1 = await SELF.fetch(url(HOST_TENANT_A, "/api/deals?limit=1"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r1.status).toBe(200);
    const p1 = (await r1.json()) as DealsPage;
    expect(p1.items).toHaveLength(1);
    expect(p1.nextCursor).toBeTruthy();
    const r2 = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals?limit=1&cursor=${encodeURIComponent(p1.nextCursor!)}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(r2.status).toBe(200);
    const p2 = (await r2.json()) as DealsPage;
    expect(p2.items).toHaveLength(1);
    expect(p2.items[0]!.id).not.toBe(p1.items[0]!.id);
  });

  it("GET / rejects malformed cursor with 400", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals?cursor=not-base64"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("GET / filters by customerId", async () => {
    // Seed an extra deal for altCustomerA so we can distinguish.
    const token = await mintJwt({ tenantId: tenantAId });
    const create = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: altCustomerA,
        primaryAgentId: primaryAgentA,
        stage: "Lead",
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as DealRow;
    dealIds.push(created.id);

    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals?customerId=${altCustomerA}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((d) => d.customerId === altCustomerA)).toBe(true);
  });

  it("GET / filters by primaryAgentId", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals?primaryAgentId=${primaryAgentA}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((d) => d.primaryAgentId === primaryAgentA)).toBe(true);
  });

  it("GET / filters by secondaryAgentId", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals?secondaryAgentId=${secondaryAgentA}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((d) => d.secondaryAgentId === secondaryAgentA)).toBe(true);
  });

  it("GET / filters by stage (free text)", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals?stage=In%20Pricing"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(body.items.every((d) => d.stage === "In Pricing")).toBe(true);
  });

  it("GET / filters by saleStatus (free text)", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals?saleStatus=Pending"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(body.items.every((d) => d.saleStatus === "Pending")).toBe(true);
  });

  it("GET / combined filters customerId + primaryAgentId", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(
        HOST_TENANT_A,
        `/api/deals?customerId=${customerA}&primaryAgentId=${primaryAgentA}`,
      ),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DealsPage;
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.every(
        (d) =>
          d.customerId === customerA && d.primaryAgentId === primaryAgentA,
      ),
    ).toBe(true);
  });

  it("GET / rejects malformed UUID filter with 400 VALIDATION", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals?customerId=not-a-uuid"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  // ---------- PATCH ----------

  it("PATCH /:id updates fields and returns 200", async () => {
    expect(dealIds[0]).toBeDefined();
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealIds[0]}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "Quoted", saleStatus: "Approved" }),
      },
    );
    expect(res.status).toBe(200);
    const row = (await res.json()) as DealRow;
    expect(row.stage).toBe("Quoted");
    expect(row.saleStatus).toBe("Approved");
  });

  it("PATCH /:id can clear secondaryAgentId with explicit null", async () => {
    expect(dealIds[0]).toBeDefined();
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealIds[0]}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ secondaryAgentId: null }),
      },
    );
    expect(res.status).toBe(200);
    const row = (await res.json()) as DealRow;
    expect(row.secondaryAgentId).toBeNull();
  });

  it("PATCH /:id unknown UUID returns 404", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals/00000000-0000-4000-8000-000000099998"),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "Won" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /:id malformed UUID returns 404", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals/not-a-uuid"),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "Won" }),
      },
    );
    expect(res.status).toBe(404);
  });

  // ---------- RLS isolation (PATCH + DELETE + GET) ----------

  it("RLS isolation: tenant A cannot PATCH/DELETE/GET tenant B's deal", async () => {
    // Seed a deal in tenant B with all-tenant-B fixtures.
    const { makeDb } = await import("../workers/db");
    const { deals, customers, agents } = await import(
      "../workers/db/schema"
    );
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );
    const db = makeDb(env);

    const seeded = await withTenantContext(db, tenantBId, async (tx) => {
      const [cust] = await tx
        .insert(customers)
        .values({ tenantId: tenantBId, name: "deals-rls-customer" })
        .returning({ id: customers.id });
      const [ag] = await tx
        .insert(agents)
        .values({ tenantId: tenantBId, name: "deals-rls-agent" })
        .returning({ id: agents.id });
      const [d] = await tx
        .insert(deals)
        .values({
          tenantId: tenantBId,
          customerId: cust!.id,
          primaryAgentId: ag!.id,
          name: "tenant-B deal",
        })
        .returning({ id: deals.id });
      return { customerId: cust!.id, agentId: ag!.id, dealId: d!.id };
    });
    customerIds.push(seeded.customerId);
    agentIds.push(seeded.agentId);
    dealIds.push(seeded.dealId);
    const dealInBTenant = seeded.dealId;

    const tokenA = await mintJwt({ tenantId: tenantAId });

    // GET → 404 (row invisible under RLS, not 403, to avoid leaking existence).
    const getRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealInBTenant}`),
      { headers: { authorization: `Bearer ${tokenA}` } },
    );
    expect(getRes.status).toBe(404);

    // PATCH → 404 (UPDATE matches zero rows under RLS).
    const patchRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealInBTenant}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "Hijacked" }),
      },
    );
    expect(patchRes.status).toBe(404);

    // DELETE → 404 (DELETE matches zero rows under RLS).
    const delRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealInBTenant}`),
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokenA}` },
      },
    );
    expect(delRes.status).toBe(404);

    // Tenant B with own token should still see + access the row — proves the
    // seed worked and we're not just blocking everything by accident.
    const tokenB = await mintJwt({ tenantId: tenantBId });
    const okRes = await SELF.fetch(
      url(HOST_TENANT_B, `/api/deals/${dealInBTenant}`),
      { headers: { authorization: `Bearer ${tokenB}` } },
    );
    expect(okRes.status).toBe(200);
  });

  // ---------- DELETE ----------

  it("DELETE /:id removes the row and returns 204", async () => {
    // Use a deal we control. Create one expressly for deletion so the
    // remaining test fixtures stay intact.
    const token = await mintJwt({ tenantId: tenantAId });
    const create = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        name: "to-be-deleted",
      }),
    });
    expect(create.status).toBe(201);
    const row = (await create.json()) as DealRow;
    // Don't push to dealIds — we're deleting it inline. afterAll cleanup OK
    // either way (inArray on a missing id is a no-op).

    const del = await SELF.fetch(url(HOST_TENANT_A, `/api/deals/${row.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);

    // Second DELETE should 404 (row gone).
    const del2 = await SELF.fetch(url(HOST_TENANT_A, `/api/deals/${row.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del2.status).toBe(404);
  });

  it("DELETE /:id malformed UUID returns 404", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/deals/not-a-uuid"),
      { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
  });

  // ---------- VALIDATION (strict mode + iso.date + empty PATCH) ----------

  it("POST 400 VALIDATION on unknown key (strict mode catches typos)", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        // Typo — should 400 not silently drop.
        primaryAgnetId: primaryAgentA,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("PATCH 400 VALIDATION on unknown key", async () => {
    expect(dealIds[0]).toBeDefined();
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealIds[0]}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stagee: "Won" }),
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("PATCH 400 VALIDATION on empty body", async () => {
    expect(dealIds[0]).toBeDefined();
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${dealIds[0]}`),
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
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST 400 VALIDATION on impossible saleDate month", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        saleDate: "2026-13-99",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST 400 VALIDATION on impossible saleDate day (Feb 30)", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        saleDate: "2026-02-30",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  // ---------- CONFLICT (unique externalSaleId) ----------

  it("POST 409 CONFLICT on duplicate externalSaleId within same tenant", async () => {
    const token = await mintJwt({ tenantId: tenantAId });
    const externalSaleId = `dup-${crypto.randomUUID()}`;

    const r1 = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        externalSaleId,
        name: "first",
      }),
    });
    expect(r1.status).toBe(201);
    const row1 = (await r1.json()) as DealRow;
    dealIds.push(row1.id);

    const r2 = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        externalSaleId,
        name: "second",
      }),
    });
    expect(r2.status).toBe(409);
    const body = (await r2.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("CONFLICT");
  });

  it("POST 201 with same externalSaleId across tenants (uniqueness scoped per tenant)", async () => {
    const externalSaleId = `cross-${crypto.randomUUID()}`;

    // Tenant A insert.
    const tokenA = await mintJwt({ tenantId: tenantAId });
    const rA = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenA}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        externalSaleId,
        name: "tenant-A copy",
      }),
    });
    expect(rA.status).toBe(201);
    const rowA = (await rA.json()) as DealRow;
    dealIds.push(rowA.id);

    // Seed tenant B fixtures inline (suite-scope only carries tenant A).
    const { makeDb } = await import("../workers/db");
    const { customers, agents } = await import("../workers/db/schema");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );
    const db = makeDb(env);

    const seeded = await withTenantContext(db, tenantBId, async (tx) => {
      const [cust] = await tx
        .insert(customers)
        .values({ tenantId: tenantBId, name: "deals-cross-tenant-customer" })
        .returning({ id: customers.id });
      const [ag] = await tx
        .insert(agents)
        .values({ tenantId: tenantBId, name: "deals-cross-tenant-agent" })
        .returning({ id: agents.id });
      return { customerId: cust!.id, agentId: ag!.id };
    });
    customerIds.push(seeded.customerId);
    agentIds.push(seeded.agentId);

    // Tenant B insert with the same externalSaleId should succeed because
    // uniqueIndex is scoped (tenant_id, external_sale_id).
    const tokenB = await mintJwt({ tenantId: tenantBId });
    const rB = await SELF.fetch(url(HOST_TENANT_B, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenB}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: seeded.customerId,
        primaryAgentId: seeded.agentId,
        externalSaleId,
        name: "tenant-B copy",
      }),
    });
    expect(rB.status).toBe(201);
    const rowB = (await rB.json()) as DealRow;
    dealIds.push(rowB.id);
    expect(rowB.externalSaleId).toBe(externalSaleId);
  });
});
