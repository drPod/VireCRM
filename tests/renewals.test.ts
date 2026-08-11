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
const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const daysFromNow = (d: number) => isoDate(Date.now() + d * 86_400_000);

interface RenewalItem {
  contractId: string;
  endDate: string;
  customerName: string;
  esiId: string;
}
interface RenewalPage {
  items: RenewalItem[];
  nextCursor: string | null;
  windowStart: string;
  windowEnd: string;
}

describe.skipIf(!hasTestDb)("/api/renewals", () => {
  let tenantA: string;
  let tenantB: string;
  let token: string;
  const contractIds: string[] = [];
  const customerIds: string[] = [];
  // active contracts ending +10 / +45 / +80 / +200 days; pending +10; B-tenant +10
  let id10: string;
  let id45: string;
  let id80: string;
  let id200: string;
  let idPending: string;
  let idTenantB: string;

  async function seedChain(tenantId: string, tag: string, contractRows: object[]) {
    const { makeDb } = await import("../workers/db");
    const { contracts, customers, esis, serviceAddresses } = await import(
      "../workers/db/schema"
    );
    const { withTenantContext } = await import("../workers/db/with-tenant-context");
    const db = makeDb(env);
    return withTenantContext(db, tenantId, async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({ tenantId, name: `renewal-${tag}` })
        .returning({ id: customers.id });
      customerIds.push(customer!.id);
      const [address] = await tx
        .insert(serviceAddresses)
        .values({ tenantId, customerId: customer!.id, city: "Austin", state: "TX" })
        .returning({ id: serviceAddresses.id });
      const [esi] = await tx
        .insert(esis)
        .values({
          tenantId,
          serviceAddressId: address!.id,
          esiId: `104437205550${tag === "a" ? "0" : "1"}0001`,
        })
        .returning({ id: esis.id });
      const ids: string[] = [];
      for (const row of contractRows) {
        const [c] = await tx
          .insert(contracts)
          .values({ tenantId, esiId: esi!.id, ...row })
          .returning({ id: contracts.id });
        ids.push(c!.id);
        contractIds.push(c!.id);
      }
      return ids;
    });
  }

  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    tenantA = ids.a;
    tenantB = ids.b;
    token = await mintJwt({ tenantId: tenantA });

    [id10, id45, id80, id200, idPending] = (await seedChain(tenantA, "a", [
      { pipelineStatus: "active", startDate: daysFromNow(-355), endDate: daysFromNow(10) },
      { pipelineStatus: "active", startDate: daysFromNow(-320), endDate: daysFromNow(45) },
      { pipelineStatus: "active", startDate: daysFromNow(-285), endDate: daysFromNow(80) },
      { pipelineStatus: "active", startDate: daysFromNow(-165), endDate: daysFromNow(200) },
      { pipelineStatus: "pending", startDate: daysFromNow(-355), endDate: daysFromNow(10) },
    ])) as [string, string, string, string, string];

    [idTenantB] = (await seedChain(tenantB, "b", [
      { pipelineStatus: "active", startDate: daysFromNow(-355), endDate: daysFromNow(10) },
    ])) as [string];
  });

  afterAll(async () => {
    const { makeDb } = await import("../workers/db");
    const { contracts, customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    // contracts first (esis FK restrict); customer cascades address + esi.
    if (contractIds.length) await db.delete(contracts).where(inArray(contracts.id, contractIds));
    if (customerIds.length) await db.delete(customers).where(inArray(customers.id, customerIds));
  });

  it("default 90-day window returns active contracts sorted by end date asc", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/renewals?limit=200"), auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenewalPage;
    const mine = body.items.filter((r) => contractIds.includes(r.contractId));
    expect(mine.map((r) => r.contractId)).toEqual([id10, id45, id80]);
    expect(body.items.some((r) => r.contractId === id200)).toBe(false);
    expect(body.items.some((r) => r.contractId === idPending)).toBe(false);
    expect(body.windowStart <= body.windowEnd).toBe(true);
    const ends = body.items.map((r) => r.endDate);
    expect([...ends].sort()).toEqual(ends);
  });

  it("days=30 narrows the window", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/renewals?days=30"), auth(token));
    const body = (await res.json()) as RenewalPage;
    const mine = body.items.filter((r) => contractIds.includes(r.contractId));
    expect(mine.map((r) => r.contractId)).toEqual([id10]);
  });

  it("days=365 widens the window to include the +200 contract", async () => {
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/renewals?days=365&limit=200"),
      auth(token),
    );
    const body = (await res.json()) as RenewalPage;
    expect(body.items.some((r) => r.contractId === id200)).toBe(true);
  });

  it("rows carry the joined customer + esi columns", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/renewals"), auth(token));
    const body = (await res.json()) as RenewalPage;
    const row = body.items.find((r) => r.contractId === id10);
    expect(row?.customerName).toBe("renewal-a");
    expect(row?.esiId).toBe("10443720555000001");
  });

  it("paginates with an end-date cursor", async () => {
    const first = await SELF.fetch(url(HOST_TENANT_A, "/api/renewals?limit=1"), auth(token));
    const p1 = (await first.json()) as RenewalPage;
    expect(p1.items.length).toBe(1);
    expect(p1.nextCursor).not.toBeNull();
    const second = await SELF.fetch(
      url(HOST_TENANT_A, `/api/renewals?limit=200&cursor=${p1.nextCursor}`),
      auth(token),
    );
    const p2 = (await second.json()) as RenewalPage;
    expect(p2.items.some((r) => r.contractId === p1.items[0]!.contractId)).toBe(false);
    const all = [...p1.items, ...p2.items].filter((r) => contractIds.includes(r.contractId));
    expect(all.map((r) => r.contractId)).toEqual([id10, id45, id80]);
  });

  it("does not leak tenant B contracts to tenant A", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/renewals"), auth(token));
    const body = (await res.json()) as RenewalPage;
    expect(body.items.some((r) => r.contractId === idTenantB)).toBe(false);
  });

  it("tenant B sees only its own renewal", async () => {
    const tokenB = await mintJwt({ tenantId: tenantB });
    const res = await SELF.fetch(url(HOST_TENANT_B, "/api/renewals"), auth(tokenB));
    const body = (await res.json()) as RenewalPage;
    const mine = body.items.filter((r) => contractIds.includes(r.contractId));
    expect(mine.map((r) => r.contractId)).toEqual([idTenantB]);
  });

  it("rejects bad params with 400 VALIDATION", async () => {
    for (const qs of ["days=0", "days=366", "days=abc", "limit=999", "cursor=%25%25"]) {
      const res = await SELF.fetch(url(HOST_TENANT_A, `/api/renewals?${qs}`), auth(token));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("VALIDATION");
    }
  });

  it("rejects unauthenticated requests", async () => {
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/renewals"));
    expect(res.status).toBe(401);
  });
});
