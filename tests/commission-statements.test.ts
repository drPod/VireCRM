import { SELF, env } from "cloudflare:test";
import { afterAll, describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  HOST_TENANT_B,
  getSeededTenantIds,
  hasTestDb,
  mintJwt,
} from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

// Authed request helpers. Every test stamps `authorization: Bearer …` and
// (for write methods) `content-type: application/json`. Centralising keeps
// the test bodies focused on the assertion under test.
function authedGet(host: string, path: string, token: string): Promise<Response> {
  return SELF.fetch(url(host, path), {
    headers: { authorization: `Bearer ${token}` },
  });
}

function authedJson(
  method: "POST" | "PATCH",
  host: string,
  path: string,
  token: string,
  body: unknown,
): Promise<Response> {
  return SELF.fetch(url(host, path), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const authedPost = (host: string, path: string, token: string, body: unknown) =>
  authedJson("POST", host, path, token, body);
const authedPatch = (host: string, path: string, token: string, body: unknown) =>
  authedJson("PATCH", host, path, token, body);

function authedDelete(host: string, path: string, token: string): Promise<Response> {
  return SELF.fetch(url(host, path), {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}

interface SeedIds {
  customerId: string;
  serviceAddressId: string;
  esiId: string;
  contractId: string;
}

// Seeds an FK chain for a tenant. Each commission_statement requires a real
// contract (FK with ON DELETE CASCADE), which requires an ESI, which requires
// a service_address, which requires a customer. We seed once per test
// describe-block and delete via cascade.
async function seedFkChain(tenantId: string): Promise<SeedIds> {
  const { makeDb } = await import("../workers/db");
  const { customers, serviceAddresses, esis, contracts } = await import(
    "../workers/db/schema"
  );
  const { withTenantContext } = await import("../workers/db/with-tenant-context");
  const db = makeDb(env);
  return withTenantContext(db, tenantId, async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ tenantId, name: `comm-test-customer-${crypto.randomUUID()}` })
      .returning({ id: customers.id });
    const [sa] = await tx
      .insert(serviceAddresses)
      .values({ tenantId, customerId: customer!.id, city: "Austin", state: "TX" })
      .returning({ id: serviceAddresses.id });
    const [esi] = await tx
      .insert(esis)
      .values({
        tenantId,
        serviceAddressId: sa!.id,
        esiId: `1044372${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
      })
      .returning({ id: esis.id });
    const [contract] = await tx
      .insert(contracts)
      .values({ tenantId, esiId: esi!.id })
      .returning({ id: contracts.id });
    return {
      customerId: customer!.id,
      serviceAddressId: sa!.id,
      esiId: esi!.id,
      contractId: contract!.id,
    };
  });
}

interface StatementResponse {
  id: string;
  contractId: string;
  statementBatchId: string | null;
  supplier: string | null;
  billingAqKwh: string | null;
  mils: string | null;
  expectedAmount: string | null;
  receivedAmount: string | null;
  reconciliationStatus: string | null;
  // Used by the empty-PATCH no-op test to assert updatedAt isn't bumped.
  updatedAt: string;
}

describe.skipIf(!hasTestDb)("commission-statements CRUD", () => {
  const insertedStatementIds: string[] = [];
  const insertedContractIds: string[] = [];
  const insertedCustomerIds: string[] = [];

  // Track everything seedFkChain returned so afterAll can delete in the order
  // FK constraints require (contracts have `RESTRICT` on esi_id; customers
  // cascade to service_addresses → esis).
  function trackSeed(seed: SeedIds): void {
    insertedContractIds.push(seed.contractId);
    insertedCustomerIds.push(seed.customerId);
  }

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { commissionStatements, contracts, customers } = await import(
      "../workers/db/schema"
    );
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    // Order matters: statements → contracts → customers.
    //   - `commissionStatements.contractId` → contracts (CASCADE) — but we
    //     drop explicitly so the test owns ID cleanup.
    //   - `contracts.esiId` → esis (RESTRICT) — must clear contracts before
    //     deleting customers (which cascades to service_addresses → esis).
    //   - Customer delete cascades to service_addresses → esis.
    if (insertedStatementIds.length > 0) {
      await db
        .delete(commissionStatements)
        .where(inArray(commissionStatements.id, insertedStatementIds));
    }
    if (insertedContractIds.length > 0) {
      await db.delete(contracts).where(inArray(contracts.id, insertedContractIds));
    }
    if (insertedCustomerIds.length > 0) {
      await db.delete(customers).where(inArray(customers.id, insertedCustomerIds));
    }
  });

  it("GET / returns shape for empty filter", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedGet(HOST_TENANT_A, "/api/commission-statements", token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; nextCursor: string | null };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(
      true,
    );
  });

  it("POST creates a statement and computes expectedAmount", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      {
        contractId: seed.contractId,
        supplier: "TXU Energy",
        billingAqKwh: "100000",
        mils: "5",
      },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as StatementResponse;
    insertedStatementIds.push(body.id);

    // expectedAmount = billingAqKwh * mils / 1000 = 100000 * 5 / 1000 = 500.
    // Numeric returned as string; tolerate trailing zeros (e.g. "500.00").
    expect(parseFloat(body.expectedAmount!)).toBeCloseTo(500, 2);
    // No receivedAmount set yet → reconciliationStatus = 'pending'.
    expect(body.reconciliationStatus).toBe("pending");
    expect(body.contractId).toBe(seed.contractId);
  });

  it("POST 400 VALIDATION when body includes generated expectedAmount", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      {
        contractId: seed.contractId,
        billingAqKwh: "1000",
        mils: "2",
        expectedAmount: "999",
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST 400 VALIDATION when body includes generated reconciliationStatus", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId, reconciliationStatus: "matched" },
    );
    expect(res.status).toBe(400);
  });

  it("GET /:id returns generated cols (expectedAmount + reconciliationStatus)", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const createRes = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      {
        contractId: seed.contractId,
        billingAqKwh: "50000",
        mils: "4",
        receivedAmount: "200",
      },
    );
    const created = (await createRes.json()) as StatementResponse;
    insertedStatementIds.push(created.id);

    const getRes = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements/${created.id}`,
      token,
    );
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as StatementResponse;
    // 50000 * 4 / 1000 = 200 → matched (within 0.01).
    expect(parseFloat(got.expectedAmount!)).toBeCloseTo(200, 2);
    expect(got.reconciliationStatus).toBe("matched");
  });

  it("GET /?contractId=… filters to matching contract", async () => {
    const ids = await getSeededTenantIds();
    const seedA = await seedFkChain(ids.a);
    const seedB = await seedFkChain(ids.a);
    trackSeed(seedA);
    trackSeed(seedB);

    const token = await mintJwt({ tenantId: ids.a });
    for (const contractId of [seedA.contractId, seedB.contractId]) {
      const r = await authedPost(
        HOST_TENANT_A,
        "/api/commission-statements",
        token,
        { contractId, supplier: "TXU" },
      );
      const body = (await r.json()) as StatementResponse;
      insertedStatementIds.push(body.id);
    }

    const res = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements?contractId=${seedA.contractId}`,
      token,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: StatementResponse[];
      nextCursor: string | null;
    };
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    // Every returned row matches the filter — no leakage of other contract's
    // rows through the filter.
    for (const item of body.items) {
      expect(item.contractId).toBe(seedA.contractId);
    }
  });

  it("GET /?supplier=… filters to matching supplier", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);
    const uniqueSupplier = `supplier-${crypto.randomUUID()}`;

    const token = await mintJwt({ tenantId: ids.a });
    const create = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId, supplier: uniqueSupplier },
    );
    const created = (await create.json()) as StatementResponse;
    insertedStatementIds.push(created.id);

    const res = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements?supplier=${encodeURIComponent(uniqueSupplier)}`,
      token,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: StatementResponse[];
    };
    expect(body.items.length).toBe(1);
    expect(body.items[0]!.supplier).toBe(uniqueSupplier);
  });

  it("GET /?statementBatchId=… filters to matching batch", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);
    const batchId = crypto.randomUUID();

    const token = await mintJwt({ tenantId: ids.a });
    const create = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId, statementBatchId: batchId },
    );
    const created = (await create.json()) as StatementResponse;
    insertedStatementIds.push(created.id);

    const res = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements?statementBatchId=${batchId}`,
      token,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: StatementResponse[] };
    expect(body.items.length).toBe(1);
    expect(body.items[0]!.statementBatchId).toBe(batchId);
  });

  it("GET / cursor pagination yields stable order across pages", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);
    const batchId = crypto.randomUUID();
    const token = await mintJwt({ tenantId: ids.a });

    // Seed 3 rows tagged with a unique batchId so paging filters them only.
    for (let i = 0; i < 3; i++) {
      const r = await authedPost(
        HOST_TENANT_A,
        "/api/commission-statements",
        token,
        { contractId: seed.contractId, statementBatchId: batchId },
      );
      const body = (await r.json()) as StatementResponse;
      insertedStatementIds.push(body.id);
    }

    const page1Res = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements?limit=2&statementBatchId=${batchId}`,
      token,
    );
    const page1 = (await page1Res.json()) as {
      items: StatementResponse[];
      nextCursor: string | null;
    };
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2Res = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements?limit=2&statementBatchId=${batchId}&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      token,
    );
    const page2 = (await page2Res.json()) as {
      items: StatementResponse[];
      nextCursor: string | null;
    };
    expect(page2.items.length).toBe(1);
    const page1Ids = new Set(page1.items.map((i) => i.id));
    expect(page1Ids.has(page2.items[0]!.id)).toBe(false);
  });

  it("PATCH /:id updates fields and returns refreshed generated cols", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const create = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId, billingAqKwh: "1000", mils: "10" },
    );
    const created = (await create.json()) as StatementResponse;
    insertedStatementIds.push(created.id);
    // 1000 * 10 / 1000 = 10.
    expect(parseFloat(created.expectedAmount!)).toBeCloseTo(10, 2);

    const patch = await authedPatch(
      HOST_TENANT_A,
      `/api/commission-statements/${created.id}`,
      token,
      { billingAqKwh: "2000", supplier: "Reliant" },
    );
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as StatementResponse;
    // mils stayed at 10, billingAqKwh → 2000 → expected = 2000*10/1000 = 20.
    expect(parseFloat(patched.expectedAmount!)).toBeCloseTo(20, 2);
    expect(patched.supplier).toBe("Reliant");
  });

  it("PATCH 404 on unknown id", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPatch(
      HOST_TENANT_A,
      "/api/commission-statements/00000000-0000-4000-8000-000000000999",
      token,
      { supplier: "x" },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH 404 on malformed UUID", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPatch(
      HOST_TENANT_A,
      "/api/commission-statements/not-a-uuid",
      token,
      { supplier: "x" },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE removes the row (204)", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const create = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId },
    );
    const created = (await create.json()) as StatementResponse;

    const del = await authedDelete(
      HOST_TENANT_A,
      `/api/commission-statements/${created.id}`,
      token,
    );
    expect(del.status).toBe(204);

    // 2nd DELETE → 404; proves row really gone.
    const del2 = await authedDelete(
      HOST_TENANT_A,
      `/api/commission-statements/${created.id}`,
      token,
    );
    expect(del2.status).toBe(404);
  });

  it("DELETE 404 on malformed UUID", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedDelete(
      HOST_TENANT_A,
      "/api/commission-statements/garbage",
      token,
    );
    expect(res.status).toBe(404);
  });

  it("GET /:id 404 on malformed UUID", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedGet(
      HOST_TENANT_A,
      "/api/commission-statements/garbage",
      token,
    );
    expect(res.status).toBe(404);
  });

  it("RLS isolation: tenant-A cannot GET tenant-B row (404)", async () => {
    const ids = await getSeededTenantIds();
    const seedB = await seedFkChain(ids.b);
    trackSeed(seedB);

    const tokenB = await mintJwt({ tenantId: ids.b });
    const create = await authedPost(
      HOST_TENANT_B,
      "/api/commission-statements",
      tokenB,
      { contractId: seedB.contractId },
    );
    const createdB = (await create.json()) as StatementResponse;
    insertedStatementIds.push(createdB.id);

    // Tenant-A JWT requesting tenant-B's row → 404, not 200. RLS hides it.
    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await authedGet(
      HOST_TENANT_A,
      `/api/commission-statements/${createdB.id}`,
      tokenA,
    );
    expect(res.status).toBe(404);

    // Tenant-B can still see it (proves the seed worked, isn't a global block).
    const okB = await authedGet(
      HOST_TENANT_B,
      `/api/commission-statements/${createdB.id}`,
      tokenB,
    );
    expect(okB.status).toBe(200);
  });

  it("RLS isolation: tenant-A PATCH on tenant-B row returns 404", async () => {
    const ids = await getSeededTenantIds();
    const seedB = await seedFkChain(ids.b);
    trackSeed(seedB);

    const tokenB = await mintJwt({ tenantId: ids.b });
    const create = await authedPost(
      HOST_TENANT_B,
      "/api/commission-statements",
      tokenB,
      { contractId: seedB.contractId },
    );
    const createdB = (await create.json()) as StatementResponse;
    insertedStatementIds.push(createdB.id);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await authedPatch(
      HOST_TENANT_A,
      `/api/commission-statements/${createdB.id}`,
      tokenA,
      { supplier: "leaked" },
    );
    expect(res.status).toBe(404);
  });

  it("RLS isolation: tenant-A DELETE on tenant-B row returns 404", async () => {
    const ids = await getSeededTenantIds();
    const seedB = await seedFkChain(ids.b);
    trackSeed(seedB);

    const tokenB = await mintJwt({ tenantId: ids.b });
    const create = await authedPost(
      HOST_TENANT_B,
      "/api/commission-statements",
      tokenB,
      { contractId: seedB.contractId },
    );
    const createdB = (await create.json()) as StatementResponse;
    insertedStatementIds.push(createdB.id);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await authedDelete(
      HOST_TENANT_A,
      `/api/commission-statements/${createdB.id}`,
      tokenA,
    );
    expect(res.status).toBe(404);
  });

  it("POST 400 VALIDATION on impossible calendar date (2026-02-31)", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId, periodStart: "2026-02-31" },
    );
    // Regex alone would accept this; the calendar refine rejects it before
    // Postgres can throw a driver-level error → would otherwise surface as 500.
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST 400 VALIDATION when numeric field arrives as JS number", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const res = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      // JSON number, not string. `String(0.1 + 0.2)` would have stored
      // "0.30000000000000004" on the NUMERIC column — boundary must reject.
      { contractId: seed.contractId, billingAqKwh: 1.5 },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("PATCH /:id with empty body is a no-op (no updatedAt bump)", async () => {
    const ids = await getSeededTenantIds();
    const seed = await seedFkChain(ids.a);
    trackSeed(seed);

    const token = await mintJwt({ tenantId: ids.a });
    const create = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      token,
      { contractId: seed.contractId, supplier: "TXU" },
    );
    const created = (await create.json()) as StatementResponse;
    insertedStatementIds.push(created.id);

    const patch = await authedPatch(
      HOST_TENANT_A,
      `/api/commission-statements/${created.id}`,
      token,
      {},
    );
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as StatementResponse;
    // Short-circuit fires → row returned via GET, updatedAt unchanged.
    // Guard against both timestamps being undefined (JSON cast, not runtime
    // validated) silently passing the equality check.
    expect(created.updatedAt).toBeTruthy();
    expect(patched.updatedAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(created.updatedAt))).toBe(false);
    expect(Number.isNaN(Date.parse(patched.updatedAt))).toBe(false);
    expect(patched.updatedAt).toBe(created.updatedAt);
    expect(patched.supplier).toBe("TXU");
  });

  it("POST 404 NOT_FOUND when contractId belongs to another tenant", async () => {
    // FK-precheck inside `createCommissionStatement` must block the write so
    // it can't land with `tenant_id=A, contract_id=<B>` (Postgres FK bypasses
    // RLS). 404 mirrors service-addresses — no shape leak.
    const ids = await getSeededTenantIds();
    const seedB = await seedFkChain(ids.b);
    trackSeed(seedB);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      tokenA,
      { contractId: seedB.contractId, supplier: "should-not-write" },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("PATCH 400 VALIDATION when body tries to change contractId", async () => {
    // `UpdateBody` strips `contractId` + is `.strict()`, so the boundary
    // rejects re-parenting before the query layer sees it.
    const ids = await getSeededTenantIds();
    const seedA = await seedFkChain(ids.a);
    const seedB = await seedFkChain(ids.b);
    trackSeed(seedA);
    trackSeed(seedB);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const create = await authedPost(
      HOST_TENANT_A,
      "/api/commission-statements",
      tokenA,
      { contractId: seedA.contractId },
    );
    const created = (await create.json()) as StatementResponse;
    insertedStatementIds.push(created.id);

    const res = await authedPatch(
      HOST_TENANT_A,
      `/api/commission-statements/${created.id}`,
      tokenA,
      { contractId: seedB.contractId },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });
});
