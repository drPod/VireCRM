import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentCache } from "../../scripts/migrate-xlsx/dedup";
import { loadRow } from "../../scripts/migrate-xlsx/load";
import type { TransformedRow } from "../../scripts/migrate-xlsx/types";
import { getSeededTenantIds, hasTestDb } from "../setup";

// Unique prefix so this file's rows are easy to delete + don't collide with
// other tests' seeded data even if they share a tenant.
const PREFIX = `load-conflicts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ALL_NULL_ADDRESS = {
  streetNo: null,
  streetName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zip: null,
} as const;

// Local helper mirroring dedup.test.ts's makeRow(). All fields nullable
// except identity quartet (externalSaleId, externalCustomerId, customerName,
// esiId) which load.ts requires.
function makeRow(overrides: Partial<TransformedRow> = {}): TransformedRow {
  return {
    rowNumber: 1,
    externalSaleId: `${PREFIX}-sale-1`,
    externalCustomerId: `${PREFIX}-cust-1`,
    customerName: "Acme",
    esiId: `${PREFIX}-esi-1`,
    primaryContactName: null,
    primaryTitle: null,
    primaryEmail: null,
    primaryPhone: null,
    sicCode: null,
    businessType: null,
    category: null,
    region: null,
    customerCounty: null,
    creditScore: null,
    annualRevenue: null,
    ...ALL_NULL_ADDRESS,
    addressCounty: null,
    govtArea: null,
    physicalMeterSerial: null,
    eacKwh: null,
    billingAqKwh: null,
    annualUsageKwh: null,
    supplyType: null,
    agentMils: null,
    startDate: null,
    endDate: null,
    currency: "USD",
    fxRate: "1.0",
    grossTcvXlsx: null,
    netTcvXlsx: null,
    lostTcv: null,
    lostPartial: false,
    isLive: false,
    supplier: null,
    lostDate: null,
    lostReason: null,
    lostBeforeStart: false,
    aqLoss: null,
    aqGain: null,
    lostAfterLive: false,
    completedPostLive: false,
    saleType: null,
    aqCheck: null,
    resoldStatus: null,
    nomination: null,
    paymentTerm: null,
    isResold: false,
    resoldSaleId: null,
    contractEnded: false,
    pipelineStatus: "pending",
    saleDate: null,
    saleStatus: null,
    objectionStatus: null,
    objectionType: null,
    sourceOfLead: null,
    primaryAgentName: null,
    secondaryAgentName: null,
    receivedAmount: null,
    outstandingAmount: null,
    netOutstanding: null,
    agentCommsPaid: null,
    agentCommsOutstanding: null,
    aggregatorName: null,
    aggregatorCommPct: null,
    ...overrides,
  };
}

// DB-gated. loadRow drives real ON CONFLICT clauses + xmax detection — only
// meaningful against Postgres. Test connection runs through RLS via
// withTenantContext: load.ts's UPSERTs must succeed under the authenticated
// role with the seeded tenant claim, mirroring the script's runtime path.
describe.skipIf(!hasTestDb)("loadRow — ON CONFLICT upsert behaviors (DB-gated)", () => {
  // Lazy-import so the skip path doesn't pay the drizzle load cost.
  let mods: {
    makeDb: typeof import("../../workers/db")["makeDb"];
    withTenantContext: typeof import("../../workers/db/with-tenant-context")["withTenantContext"];
    schema: typeof import("../../workers/db/schema");
    eq: typeof import("drizzle-orm")["eq"];
    and: typeof import("drizzle-orm")["and"];
    like: typeof import("drizzle-orm")["like"];
  };
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    const [dbMod, ctxMod, schemaMod, orm, ids] = await Promise.all([
      import("../../workers/db"),
      import("../../workers/db/with-tenant-context"),
      import("../../workers/db/schema"),
      import("drizzle-orm"),
      getSeededTenantIds(),
    ]);
    mods = {
      makeDb: dbMod.makeDb,
      withTenantContext: ctxMod.withTenantContext,
      schema: schemaMod,
      eq: orm.eq,
      and: orm.and,
      like: orm.like,
    };
    tenantA = ids.a;
    tenantB = ids.b;
  });

  // Cleanup. FK chain:
  //   customer → service_address → esi  (both cascade)
  //   esi → contract                    (RESTRICT)
  //   contract → commission_statement   (cascade)
  //   contract → aggregator_payout      (cascade)
  //   contract → deal                   (set null)
  //   customer → deal                   (cascade)
  // So we must delete contracts first (by external_sale_id prefix); that
  // clears the RESTRICT pin on esis and cascades commission_statements +
  // aggregator_payouts. Then deleting customers cascades the rest.
  afterAll(async () => {
    const { makeDb, withTenantContext, schema, and, eq, like } = mods;
    for (const tenantId of [tenantA, tenantB]) {
      await withTenantContext(makeDb(env), tenantId, async (tx) => {
        await tx
          .delete(schema.contracts)
          .where(
            and(
              eq(schema.contracts.tenantId, tenantId),
              like(schema.contracts.externalSaleId, `${PREFIX}-%`),
            ),
          );
        await tx
          .delete(schema.customers)
          .where(
            and(
              eq(schema.customers.tenantId, tenantId),
              like(schema.customers.externalCustomerId, `${PREFIX}-%`),
            ),
          );
      });
    }
  });

  // Convenience: invoke loadRow under the right tenant context. AgentCache
  // empty because no agent names referenced — get() returns null and load.ts
  // accepts that (deal.primaryAgentId is nullable).
  async function load(
    tenantId: string,
    row: TransformedRow,
  ): Promise<Awaited<ReturnType<typeof loadRow>>> {
    return mods.withTenantContext(mods.makeDb(env), tenantId, async (tx) =>
      loadRow(tx, { tenantId, agentCache: new AgentCache(), saleIdToContractId: new Map() }, row),
    );
  }

  it("re-loading same External Sale Id flips deals from inserted → updated (xmax detection)", async () => {
    const row = makeRow({
      externalSaleId: `${PREFIX}-sale-xmax`,
      externalCustomerId: `${PREFIX}-cust-xmax`,
      esiId: `${PREFIX}-esi-xmax`,
    });

    const first = await load(tenantA, row);
    // First insert: every table reports inserted=1 (xmax=0 on a fresh tuple).
    expect(first.counts.customers.inserted).toBe(1);
    expect(first.counts.customers.updated).toBe(0);
    expect(first.counts.deals.inserted).toBe(1);
    expect(first.counts.deals.updated).toBe(0);
    expect(first.counts.esis.inserted).toBe(1);
    expect(first.counts.contracts.inserted).toBe(1);

    const second = await load(tenantA, row);
    // ON CONFLICT branch re-tuples the row → xmax != 0 → counted as update.
    expect(second.counts.customers.inserted).toBe(0);
    expect(second.counts.customers.updated).toBe(1);
    expect(second.counts.deals.inserted).toBe(0);
    expect(second.counts.deals.updated).toBe(1);
    expect(second.counts.esis.inserted).toBe(0);
    expect(second.counts.esis.updated).toBe(1);
    expect(second.counts.contracts.inserted).toBe(0);
    expect(second.counts.contracts.updated).toBe(1);

    // Same contract row reused across both loads — the natural key is stable.
    expect(second.contractId).toBe(first.contractId);
  });

  it("same External Customer Id with identical payload still counts as updated on 2nd load", async () => {
    // Even when the column values don't change, ON CONFLICT DO UPDATE writes
    // a new tuple → xmax != 0 → counts as update. (Postgres has no "no-op
    // update" detection — DO UPDATE always re-tuples if the conflict fires.)
    const row = makeRow({
      externalSaleId: `${PREFIX}-sale-cust-idem`,
      externalCustomerId: `${PREFIX}-cust-idem`,
      esiId: `${PREFIX}-esi-cust-idem`,
      customerName: "Stable Co",
      primaryEmail: "stable@example.com",
    });

    const first = await load(tenantA, row);
    expect(first.counts.customers.inserted).toBe(1);

    const second = await load(tenantA, row);
    expect(second.counts.customers.inserted).toBe(0);
    expect(second.counts.customers.updated).toBe(1);
  });

  it("re-load with changed customer fields actually mutates the row", async () => {
    const externalCustomerId = `${PREFIX}-cust-mutate`;
    const initial = makeRow({
      externalSaleId: `${PREFIX}-sale-mutate`,
      externalCustomerId,
      esiId: `${PREFIX}-esi-mutate`,
      customerName: "Old Name",
      primaryEmail: "old@example.com",
      sicCode: "1111",
    });

    await load(tenantA, initial);

    const changed = {
      ...initial,
      customerName: "New Name",
      primaryEmail: "new@example.com",
      sicCode: "2222",
    };
    const second = await load(tenantA, changed);
    expect(second.counts.customers.updated).toBe(1);

    // Read back — UPSERT must reflect the new values, not the original.
    const { makeDb, withTenantContext, schema, and, eq } = mods;
    const stored = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({
          name: schema.customers.name,
          email: schema.customers.primaryEmail,
          sic: schema.customers.sicCode,
        })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.tenantId, tenantA),
            eq(schema.customers.externalCustomerId, externalCustomerId),
          ),
        )
        .limit(1),
    );
    expect(stored[0]).toEqual({ name: "New Name", email: "new@example.com", sic: "2222" });
  });

  it("service-address dedup: variant addresses (case/whitespace/punctuation) resolve to one row", async () => {
    // Same physical address rendered three ways. addressKey() collapses all
    // three to the same TS-side key; findServiceAddressByKey() must agree
    // via its regexp_replace(upper(...)) SQL mirror — drift = silent dedup
    // miss. Counts: 1st row = inserted, 2nd + 3rd = reused (same customer).
    const externalCustomerId = `${PREFIX}-cust-addrdedup`;
    const addressBase = {
      streetNo: "742",
      streetName: "Evergreen Terrace",
      addressLine1: null,
      addressLine2: null,
      city: "Springfield",
      state: "IL",
      zip: "62701",
    } satisfies Partial<TransformedRow>;

    const a = makeRow({
      externalSaleId: `${PREFIX}-sale-addr-A`,
      externalCustomerId,
      esiId: `${PREFIX}-esi-addr-A`,
      ...addressBase,
    });
    // Second row: same customer, same physical address but with
    // whitespace + case + punctuation noise. Different ESI/sale ids so we
    // exercise the per-customer service-address dedup, not the ESI/contract
    // UPSERT.
    const b = makeRow({
      externalSaleId: `${PREFIX}-sale-addr-B`,
      externalCustomerId,
      esiId: `${PREFIX}-esi-addr-B`,
      ...addressBase,
      streetName: "  evergreen  TERRACE.  ",
      city: "springfield",
    });
    const c = makeRow({
      externalSaleId: `${PREFIX}-sale-addr-C`,
      externalCustomerId,
      esiId: `${PREFIX}-esi-addr-C`,
      ...addressBase,
      streetName: "EVERGREEN TERRACE",
    });

    const r1 = await load(tenantA, a);
    expect(r1.counts.service_addresses.inserted).toBe(1);
    expect(r1.counts.service_addresses.reused).toBe(0);

    const r2 = await load(tenantA, b);
    expect(r2.counts.service_addresses.inserted).toBe(0);
    expect(r2.counts.service_addresses.reused).toBe(1);

    const r3 = await load(tenantA, c);
    expect(r3.counts.service_addresses.inserted).toBe(0);
    expect(r3.counts.service_addresses.reused).toBe(1);

    // Confirm at the DB level: exactly one service_addresses row for this
    // customer despite three loadRow() calls.
    const { makeDb, withTenantContext, schema, and, eq } = mods;
    const addrs = await withTenantContext(makeDb(env), tenantA, async (tx) => {
      const cust = await tx
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.tenantId, tenantA),
            eq(schema.customers.externalCustomerId, externalCustomerId),
          ),
        )
        .limit(1);
      if (!cust[0]) throw new Error("expected customer row to exist after load");
      const customerId = cust[0].id;
      return tx
        .select({ id: schema.serviceAddresses.id })
        .from(schema.serviceAddresses)
        .where(
          and(
            eq(schema.serviceAddresses.tenantId, tenantA),
            eq(schema.serviceAddresses.customerId, customerId),
          ),
        );
    });
    expect(addrs).toHaveLength(1);
  });

  it("ESI under composite (tenant_id, esi_id) — re-insert in same tenant updates, in other tenant inserts a fresh row", async () => {
    // ESI conflict target is (tenant_id, esi_id). Same esi_id in tenant A
    // twice = one row, updated on 2nd. Same esi_id in tenant B = a wholly
    // separate row (different tenant_id half of the composite key).
    const sharedEsiId = `${PREFIX}-esi-shared`;
    const rowA = makeRow({
      externalSaleId: `${PREFIX}-sale-esiA`,
      externalCustomerId: `${PREFIX}-cust-esiA`,
      esiId: sharedEsiId,
      physicalMeterSerial: "SERIAL-A-1",
    });

    const first = await load(tenantA, rowA);
    expect(first.counts.esis.inserted).toBe(1);

    const second = await load(tenantA, {
      ...rowA,
      physicalMeterSerial: "SERIAL-A-2",
    });
    expect(second.counts.esis.inserted).toBe(0);
    expect(second.counts.esis.updated).toBe(1);

    // Same esi_id, different tenant — distinct row.
    const rowB = makeRow({
      externalSaleId: `${PREFIX}-sale-esiB`,
      externalCustomerId: `${PREFIX}-cust-esiB`,
      esiId: sharedEsiId,
      physicalMeterSerial: "SERIAL-B-1",
    });
    const third = await load(tenantB, rowB);
    expect(third.counts.esis.inserted).toBe(1);
    expect(third.counts.esis.updated).toBe(0);

    // Verify at DB level: 2 esi rows globally (one per tenant), each with
    // the tenant-appropriate physical_meter_serial after the updates above.
    const { makeDb, withTenantContext, schema, and, eq } = mods;
    const aSerial = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({ serial: schema.esis.physicalMeterSerial })
        .from(schema.esis)
        .where(and(eq(schema.esis.tenantId, tenantA), eq(schema.esis.esiId, sharedEsiId)))
        .limit(1),
    );
    expect(aSerial[0]?.serial).toBe("SERIAL-A-2");

    const bSerial = await withTenantContext(makeDb(env), tenantB, async (tx) =>
      tx
        .select({ serial: schema.esis.physicalMeterSerial })
        .from(schema.esis)
        .where(and(eq(schema.esis.tenantId, tenantB), eq(schema.esis.esiId, sharedEsiId)))
        .limit(1),
    );
    expect(bSerial[0]?.serial).toBe("SERIAL-B-1");
  });

  it("cross-tenant collision: same External Sale Id in tenant A and B = two distinct rows", async () => {
    // Deals + contracts both key UPSERTs on (tenant_id, external_sale_id).
    // Cross-tenant collision must NOT trigger DO UPDATE — both calls insert.
    const sharedSaleId = `${PREFIX}-sale-cross`;
    const baseOverrides = {
      externalSaleId: sharedSaleId,
      customerName: "Cross Tenant Co",
    };

    const inA = await load(
      tenantA,
      makeRow({
        ...baseOverrides,
        externalCustomerId: `${PREFIX}-cust-crossA`,
        esiId: `${PREFIX}-esi-crossA`,
      }),
    );
    expect(inA.counts.contracts.inserted).toBe(1);
    expect(inA.counts.deals.inserted).toBe(1);

    const inB = await load(
      tenantB,
      makeRow({
        ...baseOverrides,
        externalCustomerId: `${PREFIX}-cust-crossB`,
        esiId: `${PREFIX}-esi-crossB`,
      }),
    );
    expect(inB.counts.contracts.inserted).toBe(1);
    expect(inB.counts.contracts.updated).toBe(0);
    expect(inB.counts.deals.inserted).toBe(1);
    expect(inB.counts.deals.updated).toBe(0);

    // Distinct contract IDs prove the rows didn't collapse via UPSERT.
    expect(inA.contractId).not.toBe(inB.contractId);

    // Direct DB confirmation: exactly one row per tenant for this sale id.
    const { makeDb, withTenantContext, schema, and, eq } = mods;
    for (const [tenantId, expectedContractId] of [
      [tenantA, inA.contractId],
      [tenantB, inB.contractId],
    ] as const) {
      const rows = await withTenantContext(makeDb(env), tenantId, async (tx) =>
        tx
          .select({ id: schema.contracts.id })
          .from(schema.contracts)
          .where(
            and(
              eq(schema.contracts.tenantId, tenantId),
              eq(schema.contracts.externalSaleId, sharedSaleId),
            ),
          ),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(expectedContractId);
    }
  });
});
