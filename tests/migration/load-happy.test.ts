// DB-gated integration tests for load.ts happy-path (loadRow only).
// Walks the 8-table FK chain end-to-end under withTenantContext (RLS engaged
// via SET LOCAL ROLE authenticated + request.jwt.claims). ON CONFLICT update
// branches + resoldLinks are covered in sibling test units (U4, U5).
//
// Test connection uses Hyperdrive → postgres role (BYPASSRLS) by default;
// withTenantContext drops BYPASSRLS for the tx so policies fire — mirrors the
// dedup.test.ts pattern.

import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentCache } from "../../scripts/migrate-xlsx/dedup";
import type { TransformedRow } from "../../scripts/migrate-xlsx/types";
import { getSeededTenantIds, hasTestDb } from "../setup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unique-per-test suffix so parallel workers + reruns can't collide on the
// natural keys (external_sale_id, external_customer_id, esi_id, agent name).
let SEQ = 0;
function uniqueSuffix(): string {
  SEQ++;
  return `${Date.now().toString(36)}-${SEQ}-${Math.random().toString(36).slice(2, 8)}`;
}

// Minimal TransformedRow fixture. Required identity fields populated; rest
// nulls/defaults. Local helper (not in tests/setup.ts) so parallel workers
// can't trip over shared mutable state.
function makeRow(overrides: Partial<TransformedRow> = {}): TransformedRow {
  const suffix = uniqueSuffix();
  return {
    rowNumber: 1,
    externalSaleId: `LOAD-HAPPY-SALE-${suffix}`,
    externalCustomerId: `LOAD-HAPPY-CUST-${suffix}`,
    customerName: `LoadHappy Co ${suffix}`,
    esiId: `1044372${suffix.replace(/[^0-9]/g, "").padEnd(10, "0").slice(0, 10)}`,
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
    streetNo: null,
    streetName: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    zip: null,
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

describe.skipIf(!hasTestDb)("loadRow — happy path (DB-gated)", () => {
  let mods: {
    makeDb: typeof import("../../workers/db")["makeDb"];
    schema: typeof import("../../workers/db/schema");
    withTenantContext: typeof import("../../workers/db/with-tenant-context")["withTenantContext"];
    loadRow: typeof import("../../scripts/migrate-xlsx/load")["loadRow"];
    eq: typeof import("drizzle-orm")["eq"];
    and: typeof import("drizzle-orm")["and"];
    inArray: typeof import("drizzle-orm")["inArray"];
  };
  let tenantA: string;
  let tenantB: string;

  // Track every natural key we wrote so afterAll can scrub. Order matters at
  // delete time (reverse of FK chain): deals → contracts → esis → service_addresses
  // → customers → agents. commission_statements + aggregator_payouts cascade
  // from contracts via ON DELETE CASCADE in their schemas, but we delete them
  // explicitly anyway because the cascade only fires if RLS lets us see the
  // contract — defense in depth.
  const writtenExternalSaleIds: string[] = [];
  const writtenExternalCustomerIds: string[] = [];
  const writtenEsiIds: string[] = [];
  const writtenAgentNames: string[] = [];

  beforeAll(async () => {
    const [dbMod, schemaMod, ctxMod, loadMod, orm, ids] = await Promise.all([
      import("../../workers/db"),
      import("../../workers/db/schema"),
      import("../../workers/db/with-tenant-context"),
      import("../../scripts/migrate-xlsx/load"),
      import("drizzle-orm"),
      getSeededTenantIds(),
    ]);
    mods = {
      makeDb: dbMod.makeDb,
      schema: schemaMod,
      withTenantContext: ctxMod.withTenantContext,
      loadRow: loadMod.loadRow,
      eq: orm.eq,
      and: orm.and,
      inArray: orm.inArray,
    };
    tenantA = ids.a;
    tenantB = ids.b;
  });

  afterAll(async () => {
    if (!mods) return;
    const {
      makeDb,
      schema: {
        agents,
        customers,
        contracts,
        deals,
        esis,
        commissionStatements,
        aggregatorPayouts,
      },
      withTenantContext,
      eq,
      and,
      inArray,
    } = mods;

    // Scrub under both tenants — one of the tests writes under tenantB. Each
    // tenant cleanup runs in its own withTenantContext (RLS is per-tenant).
    for (const t of [tenantA, tenantB]) {
      await withTenantContext(makeDb(env), t, async (tx) => {
        if (writtenExternalSaleIds.length > 0) {
          // deals (FK to contracts, ON DELETE SET NULL) first so contract delete
          // doesn't silently null deals we forgot.
          await tx
            .delete(deals)
            .where(
              and(
                eq(deals.tenantId, t),
                inArray(deals.externalSaleId, writtenExternalSaleIds),
              ),
            );
          // commission_statements + aggregator_payouts cascade from contracts;
          // the explicit deletes below cover both paths.
          const contractRows = await tx
            .select({ id: contracts.id })
            .from(contracts)
            .where(
              and(
                eq(contracts.tenantId, t),
                inArray(contracts.externalSaleId, writtenExternalSaleIds),
              ),
            );
          const contractIds = contractRows.map((r) => r.id);
          if (contractIds.length > 0) {
            await tx
              .delete(commissionStatements)
              .where(
                and(
                  eq(commissionStatements.tenantId, t),
                  inArray(commissionStatements.contractId, contractIds),
                ),
              );
            await tx
              .delete(aggregatorPayouts)
              .where(
                and(
                  eq(aggregatorPayouts.tenantId, t),
                  inArray(aggregatorPayouts.contractId, contractIds),
                ),
              );
            await tx
              .delete(contracts)
              .where(
                and(eq(contracts.tenantId, t), inArray(contracts.id, contractIds)),
              );
          }
        }
        if (writtenEsiIds.length > 0) {
          await tx
            .delete(esis)
            .where(and(eq(esis.tenantId, t), inArray(esis.esiId, writtenEsiIds)));
        }
        if (writtenExternalCustomerIds.length > 0) {
          // service_addresses cascades from customers (ON DELETE CASCADE).
          await tx
            .delete(customers)
            .where(
              and(
                eq(customers.tenantId, t),
                inArray(customers.externalCustomerId, writtenExternalCustomerIds),
              ),
            );
        }
        if (writtenAgentNames.length > 0) {
          await tx
            .delete(agents)
            .where(and(eq(agents.tenantId, t), inArray(agents.name, writtenAgentNames)));
        }
      });
    }
  });

  // Helper: track + invoke loadRow inside a tenant context, returning the result.
  async function runLoadRow(
    tenantId: string,
    row: TransformedRow,
    agentCache: AgentCache,
  ): Promise<Awaited<ReturnType<typeof mods.loadRow>>> {
    writtenExternalSaleIds.push(row.externalSaleId);
    writtenExternalCustomerIds.push(row.externalCustomerId);
    writtenEsiIds.push(row.esiId);
    return mods.withTenantContext(mods.makeDb(env), tenantId, async (tx) =>
      mods.loadRow(
        tx,
        {
          tenantId,
          agentCache,
          saleIdToContractId: new Map(),
        },
        row,
      ),
    );
  }

  it("inserts one row in each of customers / service_addresses / esis / contracts / deals (minimal row)", async () => {
    const row = makeRow({
      // Populate address so service_addresses gets a real INSERT instead of
      // the empty-addressKey short-circuit (which still INSERTs — short-circuit
      // skips the SELECT-then-INSERT dedup but still goes through INSERT).
      streetNo: "100",
      streetName: "Happy Path Way",
      city: "Austin",
      state: "TX",
      zip: "78701",
    });
    const agentCache = new AgentCache();
    const { counts, contractId } = await runLoadRow(tenantA, row, agentCache);

    expect(contractId).toMatch(UUID_RE);
    expect(counts.customers).toEqual({ inserted: 1, updated: 0 });
    expect(counts.service_addresses).toEqual({ inserted: 1, reused: 0 });
    expect(counts.esis).toEqual({ inserted: 1, updated: 0 });
    expect(counts.contracts).toEqual({ inserted: 1, updated: 0 });
    expect(counts.deals).toEqual({ inserted: 1, updated: 0 });
    // No commission/aggregator data on a minimal row.
    expect(counts.commission_statements).toEqual({ inserted: 0, reused: 0 });
    expect(counts.aggregator_payouts).toEqual({ inserted: 0, reused: 0 });
  });

  it("returned contractId matches the inserted contracts row", async () => {
    const row = makeRow();
    const { contractId } = await runLoadRow(tenantA, row, new AgentCache());

    const {
      makeDb,
      schema: { contracts },
      withTenantContext,
      eq,
      and,
    } = mods;
    const found = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({ id: contracts.id, externalSaleId: contracts.externalSaleId })
        .from(contracts)
        .where(and(eq(contracts.tenantId, tenantA), eq(contracts.id, contractId)))
        .limit(1),
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.externalSaleId).toBe(row.externalSaleId);
  });

  it("uses pre-warmed agent cache (no agent INSERT inside loadRow tx)", async () => {
    const agentName = `LoadHappy Agent ${uniqueSuffix()}`;
    writtenAgentNames.push(agentName);

    // Pre-warm in its own committed tx (matches the production two-pass
    // pattern in scripts/migrate-xlsx.ts).
    const agentCache = new AgentCache();
    await mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
      await agentCache.prewarm(tx, tenantA, new Set([agentName]));
    });
    expect(agentCache.insertedCount).toBe(1);
    const cachedAgentId = agentCache.get(agentName);
    expect(cachedAgentId).toMatch(UUID_RE);

    const row = makeRow({ primaryAgentName: agentName });
    const { contractId } = await runLoadRow(tenantA, row, agentCache);

    // Cache counters unchanged — loadRow.get() is pure lookup, no DB hits.
    expect(agentCache.insertedCount).toBe(1);
    expect(agentCache.reusedCount).toBe(0);

    // Deal references the pre-warmed agent id (FK ordering invariant).
    const {
      makeDb,
      schema: { deals },
      withTenantContext,
      eq,
      and,
    } = mods;
    const dealRows = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({ primaryAgentId: deals.primaryAgentId, contractId: deals.contractId })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantA), eq(deals.externalSaleId, row.externalSaleId)))
        .limit(1),
    );
    expect(dealRows).toHaveLength(1);
    expect(dealRows[0]!.primaryAgentId).toBe(cachedAgentId);
    expect(dealRows[0]!.contractId).toBe(contractId);
  });

  it("commission branch: hasCommissionData=true → commission_statements inserted (count=1)", async () => {
    // receivedAmount alone trips the hasCommissionData OR (per load.ts:305).
    const row = makeRow({ receivedAmount: "1234.56" });
    const { counts, contractId } = await runLoadRow(tenantA, row, new AgentCache());
    expect(counts.commission_statements).toEqual({ inserted: 1, reused: 0 });

    const {
      makeDb,
      schema: { commissionStatements },
      withTenantContext,
      eq,
      and,
    } = mods;
    const csRows = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({
          id: commissionStatements.id,
          tenantId: commissionStatements.tenantId,
          contractId: commissionStatements.contractId,
          receivedAmount: commissionStatements.receivedAmount,
        })
        .from(commissionStatements)
        .where(
          and(
            eq(commissionStatements.tenantId, tenantA),
            eq(commissionStatements.contractId, contractId),
          ),
        ),
    );
    expect(csRows).toHaveLength(1);
    expect(csRows[0]!.tenantId).toBe(tenantA);
    expect(csRows[0]!.receivedAmount).toBe("1234.56");
  });

  it("commission branch: all-null commission fields → skipped (count=0)", async () => {
    // Every field the hasCommissionData OR-chain checks must be null.
    // load.ts:305 — supplier counts too, so leave that null.
    const row = makeRow({
      receivedAmount: null,
      outstandingAmount: null,
      netOutstanding: null,
      agentCommsPaid: null,
      agentCommsOutstanding: null,
      billingAqKwh: null,
      supplier: null,
    });
    const { counts, contractId } = await runLoadRow(tenantA, row, new AgentCache());
    expect(counts.commission_statements).toEqual({ inserted: 0, reused: 0 });

    const {
      makeDb,
      schema: { commissionStatements },
      withTenantContext,
      eq,
      and,
    } = mods;
    const csRows = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({ id: commissionStatements.id })
        .from(commissionStatements)
        .where(
          and(
            eq(commissionStatements.tenantId, tenantA),
            eq(commissionStatements.contractId, contractId),
          ),
        ),
    );
    expect(csRows).toHaveLength(0);
  });

  it("aggregator branch: aggregatorName!=null → aggregator_payouts inserted (count=1)", async () => {
    const aggName = `LoadHappy Agg ${uniqueSuffix()}`;
    const row = makeRow({
      aggregatorName: aggName,
      aggregatorCommPct: "12.50",
    });
    const { counts, contractId } = await runLoadRow(tenantA, row, new AgentCache());
    expect(counts.aggregator_payouts).toEqual({ inserted: 1, reused: 0 });

    const {
      makeDb,
      schema: { aggregatorPayouts },
      withTenantContext,
      eq,
      and,
    } = mods;
    const apRows = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({
          tenantId: aggregatorPayouts.tenantId,
          contractId: aggregatorPayouts.contractId,
          aggregatorName: aggregatorPayouts.aggregatorName,
          aggregatorCommPct: aggregatorPayouts.aggregatorCommPct,
        })
        .from(aggregatorPayouts)
        .where(
          and(
            eq(aggregatorPayouts.tenantId, tenantA),
            eq(aggregatorPayouts.contractId, contractId),
          ),
        ),
    );
    expect(apRows).toHaveLength(1);
    expect(apRows[0]!.tenantId).toBe(tenantA);
    expect(apRows[0]!.aggregatorName).toBe(aggName);
    expect(apRows[0]!.aggregatorCommPct).toBe("12.50");
  });

  it("aggregator branch: aggregatorName=null → skipped (count=0)", async () => {
    const row = makeRow({ aggregatorName: null });
    const { counts, contractId } = await runLoadRow(tenantA, row, new AgentCache());
    expect(counts.aggregator_payouts).toEqual({ inserted: 0, reused: 0 });

    const {
      makeDb,
      schema: { aggregatorPayouts },
      withTenantContext,
      eq,
      and,
    } = mods;
    const apRows = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({ id: aggregatorPayouts.id })
        .from(aggregatorPayouts)
        .where(
          and(
            eq(aggregatorPayouts.tenantId, tenantA),
            eq(aggregatorPayouts.contractId, contractId),
          ),
        ),
    );
    expect(apRows).toHaveLength(0);
  });

  it("tenant isolation: loadRow under tenantB inserts under tenantB only", async () => {
    const row = makeRow({
      streetNo: "200",
      streetName: "Isolation Blvd",
      city: "Plano",
      state: "TX",
      zip: "75024",
    });
    const { contractId } = await runLoadRow(tenantB, row, new AgentCache());

    const {
      makeDb,
      schema: { customers, contracts, deals, esis, serviceAddresses },
      withTenantContext,
      eq,
      and,
    } = mods;

    // Every inserted row carries tenant_id = tenantB.
    const result = await withTenantContext(makeDb(env), tenantB, async (tx) => {
      const c = await tx
        .select({ tenantId: customers.tenantId })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantB),
            eq(customers.externalCustomerId, row.externalCustomerId),
          ),
        )
        .limit(1);
      const k = await tx
        .select({ tenantId: contracts.tenantId, esiId: contracts.esiId })
        .from(contracts)
        .where(and(eq(contracts.tenantId, tenantB), eq(contracts.id, contractId)))
        .limit(1);
      const d = await tx
        .select({ tenantId: deals.tenantId, contractId: deals.contractId, customerId: deals.customerId })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantB), eq(deals.externalSaleId, row.externalSaleId)))
        .limit(1);
      const e = await tx
        .select({ tenantId: esis.tenantId, serviceAddressId: esis.serviceAddressId, id: esis.id })
        .from(esis)
        .where(and(eq(esis.tenantId, tenantB), eq(esis.esiId, row.esiId)))
        .limit(1);
      const s = await tx
        .select({ tenantId: serviceAddresses.tenantId, id: serviceAddresses.id })
        .from(serviceAddresses)
        .where(
          and(
            eq(serviceAddresses.tenantId, tenantB),
            eq(serviceAddresses.id, e[0]!.serviceAddressId),
          ),
        )
        .limit(1);
      return { c, k, d, e, s };
    });

    expect(result.c).toHaveLength(1);
    expect(result.c[0]!.tenantId).toBe(tenantB);
    expect(result.k).toHaveLength(1);
    expect(result.k[0]!.tenantId).toBe(tenantB);
    expect(result.d).toHaveLength(1);
    expect(result.d[0]!.tenantId).toBe(tenantB);
    expect(result.e).toHaveLength(1);
    expect(result.e[0]!.tenantId).toBe(tenantB);
    expect(result.s).toHaveLength(1);
    expect(result.s[0]!.tenantId).toBe(tenantB);

    // Confirm FK chain: deals.contract_id == returned contractId, contracts.esi_id == esis.id,
    // esis.service_address_id == service_addresses.id (all rows verified live in tenantB).
    expect(result.d[0]!.contractId).toBe(contractId);
    expect(result.k[0]!.esiId).toBe(result.e[0]!.id);
    expect(result.e[0]!.serviceAddressId).toBe(result.s[0]!.id);

    // Sanity: tenantA query for the same external_sale_id returns nothing.
    const crossTenant = await withTenantContext(makeDb(env), tenantA, async (tx) =>
      tx
        .select({ id: contracts.id })
        .from(contracts)
        .where(
          and(eq(contracts.tenantId, tenantA), eq(contracts.externalSaleId, row.externalSaleId)),
        ),
    );
    expect(crossTenant).toHaveLength(0);
  });

  it("FK ordering: deals.customer_id matches the customer inserted in same loadRow call", async () => {
    const row = makeRow();
    const { contractId } = await runLoadRow(tenantA, row, new AgentCache());

    const {
      makeDb,
      schema: { customers, deals },
      withTenantContext,
      eq,
      and,
    } = mods;
    const result = await withTenantContext(makeDb(env), tenantA, async (tx) => {
      const cust = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantA),
            eq(customers.externalCustomerId, row.externalCustomerId),
          ),
        )
        .limit(1);
      const deal = await tx
        .select({ customerId: deals.customerId, contractId: deals.contractId })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantA), eq(deals.externalSaleId, row.externalSaleId)))
        .limit(1);
      return { cust, deal };
    });

    expect(result.cust).toHaveLength(1);
    expect(result.deal).toHaveLength(1);
    expect(result.deal[0]!.customerId).toBe(result.cust[0]!.id);
    expect(result.deal[0]!.contractId).toBe(contractId);
  });
});
