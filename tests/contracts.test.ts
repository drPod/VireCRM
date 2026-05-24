import { env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSeededTenantIds, HOST_TENANT_A, HOST_TENANT_B, hasTestDb, mintJwt } from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

// One ESI per tenant is enough for every test below; reusing avoids re-seeding
// the customer → service_address → esi chain in each `it` block.
interface SeededEsis {
  a: string;
  b: string;
}

async function seedEsiForTenant(tenantId: string): Promise<string> {
  const { makeDb } = await import("../workers/db");
  const { customers, serviceAddresses, esis } = await import("../workers/db/schema");
  const { withTenantContext } = await import("../workers/db/with-tenant-context");
  const db = makeDb(env);
  // `esiId` is `(tenant_id, esi_id)` unique — include the tenant suffix +
  // randomness so concurrent test runs don't collide.
  const suffix = `${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 10)}`;
  return withTenantContext(db, tenantId, async (tx) => {
    const [cust] = await tx
      .insert(customers)
      .values({ tenantId, name: `contract-test-cust-${suffix}` })
      .returning({ id: customers.id });
    const [sa] = await tx
      .insert(serviceAddresses)
      .values({ tenantId, customerId: cust!.id, addressLine1: "1 Test St" })
      .returning({ id: serviceAddresses.id });
    const [esi] = await tx
      .insert(esis)
      .values({
        tenantId,
        serviceAddressId: sa!.id,
        esiId: `10443720000${suffix}`,
      })
      .returning({ id: esis.id });
    return esi!.id;
  });
}

describe.skipIf(!hasTestDb)("/api/contracts CRUD", () => {
  let seededEsis: SeededEsis;
  // Tracks every row created via the API so we can clean up by primary key.
  const insertedContractIds: string[] = [];
  // Seed-fixture rows (customer / service_address / esi). The contracts FK to
  // ESI uses `ON DELETE RESTRICT` so contracts must be cleared first.
  const fixtureEsiIds: string[] = [];

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    seededEsis = {
      a: await seedEsiForTenant(ids.a),
      b: await seedEsiForTenant(ids.b),
    };
    fixtureEsiIds.push(seededEsis.a, seededEsis.b);
  });

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { contracts, esis, serviceAddresses, customers } = await import("../workers/db/schema");
    const { inArray, eq } = await import("drizzle-orm");
    const db = makeDb(env);

    if (insertedContractIds.length) {
      await db.delete(contracts).where(inArray(contracts.id, insertedContractIds));
    }
    for (const esiId of fixtureEsiIds) {
      // Walk back up the chain via the FK so we don't leave orphan customers.
      const [esiRow] = await db.select().from(esis).where(eq(esis.id, esiId));
      if (!esiRow) continue;
      const [saRow] = await db
        .select()
        .from(serviceAddresses)
        .where(eq(serviceAddresses.id, esiRow.serviceAddressId));
      await db.delete(esis).where(eq(esis.id, esiId));
      if (saRow) {
        await db.delete(serviceAddresses).where(eq(serviceAddresses.id, saRow.id));
        await db.delete(customers).where(eq(customers.id, saRow.customerId));
      }
    }
  });

  async function createOne(
    token: string,
    body: Record<string, unknown>,
    host = HOST_TENANT_A,
  ): Promise<{ status: number; row: Record<string, unknown> }> {
    const res = await SELF.fetch(url(host, "/api/contracts"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const row = (await res.json()) as Record<string, unknown>;
    if (res.status === 201 && typeof row.id === "string") {
      insertedContractIds.push(row.id);
    }
    return { status: res.status, row };
  }

  describe("GET /api/contracts (list)", () => {
    it("returns a well-shaped page even when empty for the tenant", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts"), {
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

    it("returns the inserted row in the populated list", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const created = await createOne(token, {
        esiId: seededEsis.a,
        supplier: "list-populated",
      });
      expect(created.status).toBe(201);
      const id = created.row.id as string;

      const listRes = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts"), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.status).toBe(200);
      const body = (await listRes.json()) as {
        items: Array<{ id: string }>;
      };
      expect(body.items.some((r) => r.id === id)).toBe(true);
    });

    it("paginates with a cursor (limit=1 yields nextCursor + page 2)", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      // Two more rows in tenant A so limit=1 is guaranteed to overflow.
      await createOne(token, { esiId: seededEsis.a, supplier: "cursor-1" });
      await createOne(token, { esiId: seededEsis.a, supplier: "cursor-2" });

      const page1Res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts?limit=1"), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(page1Res.status).toBe(200);
      const page1 = (await page1Res.json()) as {
        items: Array<{ id: string }>;
        nextCursor: string | null;
      };
      expect(page1.items.length).toBe(1);
      expect(typeof page1.nextCursor).toBe("string");

      const page2Res = await SELF.fetch(
        url(HOST_TENANT_A, `/api/contracts?limit=1&cursor=${page1.nextCursor}`),
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(page2Res.status).toBe(200);
      const page2 = (await page2Res.json()) as {
        items: Array<{ id: string }>;
      };
      expect(page2.items.length).toBe(1);
      // Different rows; pagination must not repeat the page-1 row.
      expect(page2.items[0]!.id).not.toBe(page1.items[0]!.id);
    });

    it("filters by ?esiId=<uuid> — only that ESI's contracts come back", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      // Second ESI in tenant A so we can prove the filter excludes the first.
      const otherEsi = await seedEsiForTenant(ids.a);
      fixtureEsiIds.push(otherEsi);

      const mineRes = await createOne(token, {
        esiId: otherEsi,
        supplier: "esi-filtered",
      });
      const mineId = mineRes.row.id as string;

      const filteredRes = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts?esiId=${otherEsi}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(filteredRes.status).toBe(200);
      const filtered = (await filteredRes.json()) as {
        items: Array<{ id: string; esiId: string }>;
      };
      expect(filtered.items.every((r) => r.esiId === otherEsi)).toBe(true);
      expect(filtered.items.some((r) => r.id === mineId)).toBe(true);
    });

    it("rejects malformed ?esiId with 400 VALIDATION", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts?esiId=not-a-uuid"), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("VALIDATION");
    });
  });

  describe("POST /api/contracts", () => {
    it("returns 201 with computed grossTcv matching annualUsage × term × mils / 1000", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const startDate = "2025-01-01";
      const endDate = "2027-01-01";
      const annualUsageKwh = 100_000;
      const agentMils = 5;
      const created = await createOne(token, {
        esiId: seededEsis.a,
        startDate,
        endDate,
        annualUsageKwh,
        agentMils,
      });
      expect(created.status).toBe(201);

      const row = created.row as {
        grossTcv: string | null;
        netTcv: string | null;
        netAq: string | null;
      };
      // Term years = (end - start) / 365.25 ≈ 1.9986 for 2025→2027 (non-leap span).
      // 100_000 * 1.9986 * 5 / 1000 ≈ 999.32
      const termYears =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25);
      const expectedGross = (annualUsageKwh * termYears * agentMils) / 1000;
      expect(row.grossTcv).not.toBeNull();
      expect(Number.parseFloat(row.grossTcv!)).toBeCloseTo(expectedGross, 1);
      expect(row.netTcv).not.toBeNull();
      // With lostTcv=NULL (treated as 0), netTcv === grossTcv.
      expect(Number.parseFloat(row.netTcv!)).toBeCloseTo(expectedGross, 1);
      // netAq column present even when aqLoss/aqGain unset (defaults to 0).
      expect(row.netAq).not.toBeNull();
    });

    it("rejects payload that includes grossTcv with 400 VALIDATION (generated column)", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          esiId: seededEsis.a,
          grossTcv: "9999.00", // Generated — Postgres would throw; Zod stops it first.
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("VALIDATION");
    });

    it("rejects payload that includes netTcv with 400 VALIDATION", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ esiId: seededEsis.a, netTcv: "100.00" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects payload that includes netAq with 400 VALIDATION", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ esiId: seededEsis.a, netAq: "100.00" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/contracts/:id", () => {
    it("returns the row with grossTcv / netTcv / netAq populated from generated cols", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const created = await createOne(token, {
        esiId: seededEsis.a,
        startDate: "2025-01-01",
        endDate: "2026-01-01",
        annualUsageKwh: 50_000,
        agentMils: 3,
        aqGain: "1000",
        aqLoss: "200",
      });
      const id = created.row.id as string;

      const res = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const row = (await res.json()) as Record<string, unknown>;
      // The three generated columns must be present in the response shape so
      // the UI can render TCV / Net AQ without recomputing in JS.
      expect("grossTcv" in row).toBe(true);
      expect("netTcv" in row).toBe(true);
      expect("netAq" in row).toBe(true);
      // netAq = aqGain - aqLoss = 1000 - 200 = 800.
      expect(Number.parseFloat(row.netAq as string)).toBeCloseTo(800, 2);
    });

    it("returns 404 for a malformed UUID path", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, "/api/contracts/not-a-uuid"), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("NOT_FOUND");
    });

    it("returns 404 for a UUID that doesn't exist in this tenant", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(
        url(HOST_TENANT_A, "/api/contracts/00000000-0000-4000-8000-000000000123"),
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/contracts/:id", () => {
    it("returns 200 and updates the row", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const created = await createOne(token, {
        esiId: seededEsis.a,
        supplier: "before-patch",
      });
      const id = created.row.id as string;

      const res = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ supplier: "after-patch", pipelineStatus: "active" }),
      });
      expect(res.status).toBe(200);
      const row = (await res.json()) as { supplier: string; pipelineStatus: string };
      expect(row.supplier).toBe("after-patch");
      expect(row.pipelineStatus).toBe("active");
    });

    it("returns 404 for a UUID that doesn't exist", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(
        url(HOST_TENANT_A, "/api/contracts/00000000-0000-4000-8000-000000000456"),
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ supplier: "ghost" }),
        },
      );
      expect(res.status).toBe(404);
    });

    it("RLS isolation: tenant-A token cannot PATCH tenant-B row (404, not 403)", async () => {
      const ids = await getSeededTenantIds();
      const tokenB = await mintJwt({ tenantId: ids.b });
      // Create the row as tenant B.
      const created = await createOne(
        tokenB,
        { esiId: seededEsis.b, supplier: "rls-target" },
        HOST_TENANT_B,
      );
      const id = created.row.id as string;

      const tokenA = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ supplier: "should-not-stick" }),
      });
      // 403 would leak existence — RLS makes the row invisible, so 404 is right.
      expect(res.status).toBe(404);
    });

    it("rejects PATCH that includes grossTcv with 400 VALIDATION", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const created = await createOne(token, { esiId: seededEsis.a });
      const id = created.row.id as string;

      const res = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ grossTcv: "1234.00" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/contracts/:id", () => {
    it("returns 204 and removes the row", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const created = await createOne(token, {
        esiId: seededEsis.a,
        supplier: "to-be-deleted",
      });
      const id = created.row.id as string;

      const delRes = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(delRes.status).toBe(204);

      // Confirm it's gone — drop it from the cleanup list since it's already deleted.
      const idx = insertedContractIds.indexOf(id);
      if (idx !== -1) insertedContractIds.splice(idx, 1);

      const getRes = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for a UUID that doesn't exist", async () => {
      const ids = await getSeededTenantIds();
      const token = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(
        url(HOST_TENANT_A, "/api/contracts/00000000-0000-4000-8000-000000000789"),
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        },
      );
      expect(res.status).toBe(404);
    });

    it("RLS isolation: tenant-A token cannot DELETE tenant-B row (404, not 403)", async () => {
      const ids = await getSeededTenantIds();
      const tokenB = await mintJwt({ tenantId: ids.b });
      const created = await createOne(
        tokenB,
        { esiId: seededEsis.b, supplier: "rls-delete-target" },
        HOST_TENANT_B,
      );
      const id = created.row.id as string;

      const tokenA = await mintJwt({ tenantId: ids.a });
      const res = await SELF.fetch(url(HOST_TENANT_A, `/api/contracts/${id}`), {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.status).toBe(404);
    });
  });
});
