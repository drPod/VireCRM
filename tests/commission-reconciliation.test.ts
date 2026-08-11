import { env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSeededTenantIds, HOST_TENANT_A, hasTestDb, mintJwt } from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;
const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

interface ReconItem {
  contractId: string;
  customerName: string;
  esiId: string;
  eacKwh: string | null;
  statementCount: number;
  billedAqKwh: string | null;
  expectedTotal: string | null;
  receivedTotal: string | null;
  matchedCount: number;
  shortCount: number;
  pendingCount: number;
}
interface ReconPage {
  items: ReconItem[];
  nextCursor: string | null;
}

describe.skipIf(!hasTestDb)("/api/commission-reconciliation", () => {
  let tenantA: string;
  let tenantB: string;
  let token: string;
  let customerId: string;
  let customerBId: string;
  // contract 1: matched + short statements; contract 2: pending; contract 3: no statements
  let contract1: string;
  let contract2: string;
  let contract3: string;
  let contractB: string;

  async function seedChain(tenantId: string, tag: string, esiDigits: string) {
    const { contracts, customers, esis, serviceAddresses } = await import("../workers/db/schema");
    const { makeDb } = await import("../workers/db");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");
    const db = makeDb(env);
    return withTenantContext(db, tenantId, async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({ tenantId, name: `recon-${tag}` })
        .returning({ id: customers.id });
      const [address] = await tx
        .insert(serviceAddresses)
        .values({ tenantId, customerId: customer!.id, city: "Houston", state: "TX" })
        .returning({ id: serviceAddresses.id });
      const [esi] = await tx
        .insert(esis)
        .values({ tenantId, serviceAddressId: address!.id, esiId: esiDigits })
        .returning({ id: esis.id });
      return { customerId: customer!.id, esiRowId: esi!.id };
    });
  }

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    tenantA = ids.a;
    tenantB = ids.b;
    token = await mintJwt({ tenantId: tenantA });

    const { commissionStatements, contracts } = await import("../workers/db/schema");
    const { makeDb } = await import("../workers/db");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");
    const db = makeDb(env);

    const a = await seedChain(tenantA, "a", "10443720666000001");
    customerId = a.customerId;
    await withTenantContext(db, tenantA, async (tx) => {
      const mk = async (over: object) => {
        const [c] = await tx
          .insert(contracts)
          .values({
            tenantId: tenantA,
            esiId: a.esiRowId,
            pipelineStatus: "active",
            annualUsageKwh: "100000",
            agentMils: "5",
            ...over,
          })
          .returning({ id: contracts.id });
        return c!.id;
      };
      contract1 = await mk({ supplier: "recon-rep-1" });
      contract2 = await mk({ supplier: "recon-rep-2" });
      contract3 = await mk({ supplier: "recon-rep-3" });

      // contract1: 80k kWh billed at 5 mils = $400 expected; $400 received
      // (matched) + 10k at 5 mils = $50 expected; $30 received (short).
      // contract2: received not set → pending.
      await tx.insert(commissionStatements).values([
        {
          tenantId: tenantA,
          contractId: contract1,
          billingAqKwh: "80000",
          mils: "5",
          receivedAmount: "400",
        },
        {
          tenantId: tenantA,
          contractId: contract1,
          billingAqKwh: "10000",
          mils: "5",
          receivedAmount: "30",
          outstandingAmount: "20",
        },
        { tenantId: tenantA, contractId: contract2, billingAqKwh: "50000", mils: "5" },
      ]);
    });

    const b = await seedChain(tenantB, "b", "10443720666100001");
    customerBId = b.customerId;
    await withTenantContext(db, tenantB, async (tx) => {
      const [c] = await tx
        .insert(contracts)
        .values({ tenantId: tenantB, esiId: b.esiRowId, pipelineStatus: "active" })
        .returning({ id: contracts.id });
      contractB = c!.id;
      await tx.insert(commissionStatements).values({
        tenantId: tenantB,
        contractId: contractB,
        billingAqKwh: "1000",
        mils: "1",
      });
    });
  });

  afterAll(async () => {
    const { contracts, customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const { makeDb } = await import("../workers/db");
    const db = makeDb(env);
    // contract delete cascades statements; customer cascades address + esi.
    const cIds = [contract1, contract2, contract3, contractB].filter(Boolean);
    if (cIds.length) await db.delete(contracts).where(inArray(contracts.id, cIds));
    const custIds = [customerId, customerBId].filter(Boolean);
    if (custIds.length) await db.delete(customers).where(inArray(customers.id, custIds));
  });

  it("rolls up statements per contract with status counts", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/commission-reconciliation?customerId=${customerId}`),
      auth(token),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReconPage;

    const r1 = body.items.find((r) => r.contractId === contract1);
    expect(r1).toBeDefined();
    expect(r1!.statementCount).toBe(2);
    expect(Number(r1!.billedAqKwh)).toBe(90000);
    expect(Number(r1!.expectedTotal)).toBe(450);
    expect(Number(r1!.receivedTotal)).toBe(430);
    expect(r1!.matchedCount).toBe(1);
    expect(r1!.shortCount).toBe(1);
    expect(r1!.pendingCount).toBe(0);
    expect(r1!.eacKwh).not.toBeNull();
    expect(r1!.customerName).toBe("recon-a");
    expect(r1!.esiId).toBe("10443720666000001");

    const r2 = body.items.find((r) => r.contractId === contract2);
    expect(r2!.pendingCount).toBe(1);

    // contracts with no statements don't appear
    expect(body.items.some((r) => r.contractId === contract3)).toBe(false);
  });

  it("status=short returns only contracts with a short statement", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/commission-reconciliation?customerId=${customerId}&status=short`),
      auth(token),
    );
    const body = (await res.json()) as ReconPage;
    expect(body.items.map((r) => r.contractId)).toEqual([contract1]);
  });

  it("status=pending returns only the pending contract", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/commission-reconciliation?customerId=${customerId}&status=pending`),
      auth(token),
    );
    const body = (await res.json()) as ReconPage;
    expect(body.items.map((r) => r.contractId)).toEqual([contract2]);
  });

  it("does not leak tenant B rollups to tenant A", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/commission-reconciliation?limit=100"),
      auth(token),
    );
    const body = (await res.json()) as ReconPage;
    expect(body.items.some((r) => r.contractId === contractB)).toBe(false);
  });

  it("paginates with a cursor", async () => {
    const first = await SELF.fetch(
      url(HOST_TENANT_A, `/api/commission-reconciliation?customerId=${customerId}&limit=1`),
      auth(token),
    );
    const p1 = (await first.json()) as ReconPage;
    expect(p1.items.length).toBe(1);
    expect(p1.nextCursor).not.toBeNull();
    const second = await SELF.fetch(
      url(
        HOST_TENANT_A,
        `/api/commission-reconciliation?customerId=${customerId}&limit=100&cursor=${p1.nextCursor}`,
      ),
      auth(token),
    );
    const p2 = (await second.json()) as ReconPage;
    const all = [...p1.items, ...p2.items].map((r) => r.contractId);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain(contract1);
    expect(all).toContain(contract2);
  });

  it("rejects bad params with 400 VALIDATION", async () => {
    for (const qs of ["status=bogus", "limit=999", "customerId=nope", "cursor=%25%25"]) {
      const res = await SELF.fetch(
        url(HOST_TENANT_A, `/api/commission-reconciliation?${qs}`),
        auth(token),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("VALIDATION");
    }
  });

  it("rejects unauthenticated requests", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/commission-reconciliation"));
    expect(res.status).toBe(401);
  });
});
