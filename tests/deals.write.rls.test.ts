import { SELF, env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  HOST_TENANT_B,
  getSeededTenantIds,
  hasTestDb,
  mintJwt,
} from "./setup";

// Cross-tenant WRITE-path RLS for /api/deals (POST + PATCH + DELETE).
//
// tests/deals.test.ts already covers the status-code shape of cross-tenant
// read/write attempts. This file adds two things the existing suite doesn't:
//
//   1. POST with a body that forges `tenant_id` = tenant B while authenticated
//      as tenant A. The Zod schema doesn't include `tenantId` so the field is
//      stripped before reaching the DB layer, and `createDeal` overrides any
//      caller `tenantId` with the handler arg. We assert the resulting row's
//      `tenant_id` is tenant A — proves the handler ignores the forged claim.
//
//   2. PATCH + DELETE cross-tenant attempts that don't just check status (404,
//      already covered) but also re-query the DB as tenant B afterwards to
//      assert the underlying row is byte-identical / still present. RLS
//      returning 0 rows from a `WHERE … AND tenant_id = $current` is what
//      makes 404 the correct response, but the existing test never verifies
//      the row didn't quietly mutate or vanish.
//
//   3. Sanity: same PATCH + DELETE issued with a tenant-B JWT actually succeed
//      against the same row id, proving the seeded row is reachable and the
//      404s above are isolation, not "row never existed."

const url = (host: string, path: string) => `https://${host}${path}`;

interface DealRow {
  id: string;
  customerId: string;
  primaryAgentId: string | null;
  secondaryAgentId: string | null;
  name: string | null;
  stage: string;
  saleStatus: string | null;
}

describe.skipIf(!hasTestDb)("/api/deals cross-tenant write RLS", () => {
  let tenantAId: string;
  let tenantBId: string;
  // Tenant A fixtures (used for POST tests).
  let customerA: string;
  let primaryAgentA: string;
  // Tenant B fixtures (used as the target of cross-tenant attempts).
  let customerB: string;
  let primaryAgentB: string;

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

    // Tenant A fixtures.
    await withTenantContext(db, tenantAId, async (tx) => {
      const [cust] = await tx
        .insert(customers)
        .values({ tenantId: tenantAId, name: "deals-write-rls-customer-A" })
        .returning({ id: customers.id });
      const [ag] = await tx
        .insert(agents)
        .values({ tenantId: tenantAId, name: "deals-write-rls-agent-A" })
        .returning({ id: agents.id });
      customerA = cust!.id;
      primaryAgentA = ag!.id;
    });
    customerIds.push(customerA);
    agentIds.push(primaryAgentA);

    // Tenant B fixtures.
    await withTenantContext(db, tenantBId, async (tx) => {
      const [cust] = await tx
        .insert(customers)
        .values({ tenantId: tenantBId, name: "deals-write-rls-customer-B" })
        .returning({ id: customers.id });
      const [ag] = await tx
        .insert(agents)
        .values({ tenantId: tenantBId, name: "deals-write-rls-agent-B" })
        .returning({ id: agents.id });
      customerB = cust!.id;
      primaryAgentB = ag!.id;
    });
    customerIds.push(customerB);
    agentIds.push(primaryAgentB);
  });

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { deals, customers, agents } = await import(
      "../workers/db/schema"
    );
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    // Run as `postgres` (BYPASSRLS) so cleanup spans both tenants in one shot.
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

  // ---------- POST: forged tenant_id is ignored ----------

  it("POST honors handler tenantId, not client-supplied tenant_id in body", async () => {
    const tokenA = await mintJwt({ tenantId: tenantAId });

    // Forge tenant_id = tenant B in the body while authenticated as tenant A.
    // The Zod CreateBody schema doesn't accept a tenantId/tenant_id field, so
    // it should be silently stripped. Even if it weren't, `createDeal` sets
    // `tenantId` from the handler arg (the verified JWT claim), not from the
    // input. Result: row must land under tenant A, not tenant B.
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/deals"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenA}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerA,
        primaryAgentId: primaryAgentA,
        name: "forged-tenant-id deal",
        // Forged claims — both naming forms to be thorough.
        tenant_id: tenantBId,
        tenantId: tenantBId,
      }),
    });

    // CreateBody is a plain `z.object(...)`, so unknown keys (including the
    // forged `tenant_id` / `tenantId`) are stripped before validation runs.
    expect(res.status).toBe(201);
    const row = (await res.json()) as DealRow;
    dealIds.push(row.id);

    // The handler response shape doesn't include tenantId, so query the row
    // directly to assert which tenant it landed in. Query as tenant B first —
    // visibility there would mean RLS is broken. Then query as tenant A —
    // must be visible.
    const { makeDb } = await import("../workers/db");
    const { deals } = await import("../workers/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );
    const db = makeDb(env);

    const fromB = await withTenantContext(db, tenantBId, async (tx) => {
      return tx
        .select({ id: deals.id, tenantId: deals.tenantId })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantBId), eq(deals.id, row.id)))
        .limit(1);
    });
    expect(fromB).toHaveLength(0);

    const fromA = await withTenantContext(db, tenantAId, async (tx) => {
      return tx
        .select({ id: deals.id, tenantId: deals.tenantId })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantAId), eq(deals.id, row.id)))
        .limit(1);
    });
    expect(fromA).toHaveLength(1);
    expect(fromA[0]!.tenantId).toBe(tenantAId);
  });

  // ---------- PATCH: cross-tenant returns 404 + row unchanged ----------

  it("PATCH cross-tenant: tenant A cannot mutate tenant B's deal (404, row unchanged)", async () => {
    // Seed a deal in tenant B with a known stage we can later assert against.
    const { makeDb } = await import("../workers/db");
    const { deals } = await import("../workers/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );
    const db = makeDb(env);

    const ORIGINAL_STAGE = "Original-Stage";
    const ORIGINAL_NAME = "deal-targeted-by-cross-tenant-patch";

    const seeded = await withTenantContext(db, tenantBId, async (tx) => {
      const [d] = await tx
        .insert(deals)
        .values({
          tenantId: tenantBId,
          customerId: customerB,
          primaryAgentId: primaryAgentB,
          name: ORIGINAL_NAME,
          stage: ORIGINAL_STAGE,
        })
        .returning({ id: deals.id });
      return d!.id;
    });
    dealIds.push(seeded);

    // Tenant A attempts to mutate tenant B's deal — must 404 (not 403,
    // because we don't want to leak existence under RLS).
    const tokenA = await mintJwt({ tenantId: tenantAId });
    const patchRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${seeded}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "Hijacked", name: "Hijacked Name" }),
      },
    );
    expect(patchRes.status).toBe(404);
    const patchBody = (await patchRes.json()) as { error?: { code?: string } };
    expect(patchBody.error?.code).toBe("NOT_FOUND");

    // Re-fetch the row under tenant B context and verify nothing changed.
    // RLS regression would let the UPDATE go through silently and we'd see
    // stage='Hijacked' here.
    const after = await withTenantContext(db, tenantBId, async (tx) => {
      return tx
        .select({
          id: deals.id,
          stage: deals.stage,
          name: deals.name,
          tenantId: deals.tenantId,
        })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantBId), eq(deals.id, seeded)))
        .limit(1);
    });
    expect(after).toHaveLength(1);
    expect(after[0]!.stage).toBe(ORIGINAL_STAGE);
    expect(after[0]!.name).toBe(ORIGINAL_NAME);
    expect(after[0]!.tenantId).toBe(tenantBId);

    // Sanity: tenant B with own JWT CAN PATCH the same row.
    // Proves the seed worked and the cross-tenant block isn't a false
    // positive from a missing row.
    const tokenB = await mintJwt({ tenantId: tenantBId });
    const patchOk = await SELF.fetch(
      url(HOST_TENANT_B, `/api/deals/${seeded}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${tokenB}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "Owner-Updated" }),
      },
    );
    expect(patchOk.status).toBe(200);
    const okRow = (await patchOk.json()) as DealRow;
    expect(okRow.stage).toBe("Owner-Updated");
  });

  // ---------- DELETE: cross-tenant returns 404 + row still present ----------

  it("DELETE cross-tenant: tenant A cannot remove tenant B's deal (404, row still present)", async () => {
    const { makeDb } = await import("../workers/db");
    const { deals } = await import("../workers/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );
    const db = makeDb(env);

    const seeded = await withTenantContext(db, tenantBId, async (tx) => {
      const [d] = await tx
        .insert(deals)
        .values({
          tenantId: tenantBId,
          customerId: customerB,
          primaryAgentId: primaryAgentB,
          name: "deal-targeted-by-cross-tenant-delete",
        })
        .returning({ id: deals.id });
      return d!.id;
    });
    // Track for cleanup. If the sanity DELETE below removes the row,
    // afterAll's `inArray` is a no-op on the missing id.
    dealIds.push(seeded);

    // Tenant A attempts DELETE — must 404.
    const tokenA = await mintJwt({ tenantId: tenantAId });
    const delRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/deals/${seeded}`),
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokenA}` },
      },
    );
    expect(delRes.status).toBe(404);
    const delBody = (await delRes.json()) as { error?: { code?: string } };
    expect(delBody.error?.code).toBe("NOT_FOUND");

    // Verify the row still exists under tenant B context. RLS regression
    // would have let the DELETE through and we'd see 0 rows here.
    const stillThere = await withTenantContext(db, tenantBId, async (tx) => {
      return tx
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantBId), eq(deals.id, seeded)))
        .limit(1);
    });
    expect(stillThere).toHaveLength(1);

    // Sanity: tenant B with own JWT CAN DELETE the same row (204).
    // Proves the row was actually reachable; the 404 above is isolation.
    const tokenB = await mintJwt({ tenantId: tenantBId });
    const delOk = await SELF.fetch(
      url(HOST_TENANT_B, `/api/deals/${seeded}`),
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokenB}` },
      },
    );
    expect(delOk.status).toBe(204);

    // And confirm the row really is gone now (under tenant B context).
    const goneAfter = await withTenantContext(db, tenantBId, async (tx) => {
      return tx
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantBId), eq(deals.id, seeded)))
        .limit(1);
    });
    expect(goneAfter).toHaveLength(0);
  });
});
