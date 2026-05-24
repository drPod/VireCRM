// DB-gated tests for resolveResoldLinks (pass 2 of the xlsx migration).
// Verifies the in-memory map hit + DB fallback + missing-source handling +
// cross-tenant safety + idempotency. Per-row loadRow inserts are exercised
// only as a fixture-setup helper — happy-path coverage lives in unit 3.
//
// Note: makeRow defaults leave `supplier` and all commission fields null, so
// loadRow's hasCommissionData branch stays cold (no commission_statements
// rows to clean up). aggregator/agent paths are likewise cold by default.
// Only customers + service_addresses + esis + contracts + deals are touched.

import { env } from "cloudflare:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TransformedRow } from "../../scripts/migrate-xlsx/types";
import { getSeededTenantIds, hasTestDb } from "../setup";

const ALL_NULL_ADDRESS = {
  streetNo: null,
  streetName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zip: null,
} as const;

// Local fixture matching dedup.test.ts shape. Required-string identity fields
// get default values; tests override `externalSaleId`, `externalCustomerId`,
// `esiId`, and `resoldSaleId` as needed.
function makeRow(overrides: Partial<TransformedRow> = {}): TransformedRow {
  return {
    rowNumber: 1,
    externalSaleId: "EXT-1",
    externalCustomerId: "CUST-1",
    customerName: "Acme",
    esiId: "10443720000000001",
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

describe.skipIf(!hasTestDb)("resolveResoldLinks — DB-gated", () => {
  // Lazy-import inside beforeAll — skip path mustn't pay the drizzle load.
  let mods: {
    makeDb: typeof import("../../workers/db")["makeDb"];
    withTenantContext: typeof import("../../workers/db/with-tenant-context")["withTenantContext"];
    loadRow: typeof import("../../scripts/migrate-xlsx/load")["loadRow"];
    resolveResoldLinks: typeof import("../../scripts/migrate-xlsx/load")["resolveResoldLinks"];
    QuarantineSink: typeof import("../../scripts/migrate-xlsx/quarantine")["QuarantineSink"];
    AgentCache: typeof import("../../scripts/migrate-xlsx/dedup")["AgentCache"];
    customers: typeof import("../../workers/db/schema")["customers"];
    contracts: typeof import("../../workers/db/schema")["contracts"];
    eq: typeof import("drizzle-orm")["eq"];
    and: typeof import("drizzle-orm")["and"];
    inArray: typeof import("drizzle-orm")["inArray"];
  };
  let tenantA: string;
  let tenantB: string;
  const insertedExternalCustomerIds: { tenantId: string; ext: string }[] = [];
  const insertedExternalSaleIds: { tenantId: string; ext: string }[] = [];
  let tmpDir: string;

  beforeAll(async () => {
    const [dbMod, ctxMod, loadMod, qMod, dedupMod, schemaMod, orm, ids] =
      await Promise.all([
        import("../../workers/db"),
        import("../../workers/db/with-tenant-context"),
        import("../../scripts/migrate-xlsx/load"),
        import("../../scripts/migrate-xlsx/quarantine"),
        import("../../scripts/migrate-xlsx/dedup"),
        import("../../workers/db/schema"),
        import("drizzle-orm"),
        getSeededTenantIds(),
      ]);
    mods = {
      makeDb: dbMod.makeDb,
      withTenantContext: ctxMod.withTenantContext,
      loadRow: loadMod.loadRow,
      resolveResoldLinks: loadMod.resolveResoldLinks,
      QuarantineSink: qMod.QuarantineSink,
      AgentCache: dedupMod.AgentCache,
      customers: schemaMod.customers,
      contracts: schemaMod.contracts,
      eq: orm.eq,
      and: orm.and,
      inArray: orm.inArray,
    };
    tenantA = ids.a;
    tenantB = ids.b;
    tmpDir = mkdtempSync(join(tmpdir(), "resold-test-"));
  });

  afterAll(async () => {
    // Contracts.esi_id is onDelete:restrict, so a customer DELETE alone won't
    // cascade through esis. Drop contracts explicitly first, then customers —
    // customers cascade-delete service_addresses + esis + deals.
    const { makeDb, withTenantContext, customers, contracts, eq, and, inArray } = mods;

    const byTenant = (rows: { tenantId: string; ext: string }[], tid: string) =>
      rows.filter((r) => r.tenantId === tid).map((r) => r.ext);

    for (const tid of [tenantA, tenantB]) {
      const sales = byTenant(insertedExternalSaleIds, tid);
      const custs = byTenant(insertedExternalCustomerIds, tid);
      if (sales.length === 0 && custs.length === 0) continue;
      await withTenantContext(makeDb(env), tid, async (tx) => {
        if (sales.length > 0) {
          await tx
            .delete(contracts)
            .where(
              and(
                eq(contracts.tenantId, tid),
                inArray(contracts.externalSaleId, sales),
              ),
            );
        }
        if (custs.length > 0) {
          await tx
            .delete(customers)
            .where(
              and(
                eq(customers.tenantId, tid),
                inArray(customers.externalCustomerId, custs),
              ),
            );
        }
      });
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Run `loadRow` for every row inside one withTenantContext tx. Returns the
  // resulting contractId map keyed by external_sale_id so callers can build
  // the cross-row state the way migrate-xlsx.ts does in prod.
  async function loadAll(
    tenantId: string,
    rows: TransformedRow[],
    saleIdToContractId: Map<string, string>,
  ): Promise<void> {
    const { makeDb, withTenantContext, loadRow, AgentCache } = mods;
    const agentCache = new AgentCache();
    await withTenantContext(makeDb(env), tenantId, async (tx) => {
      for (const row of rows) {
        const result = await loadRow(
          tx,
          { tenantId, agentCache, saleIdToContractId },
          row,
        );
        saleIdToContractId.set(row.externalSaleId, result.contractId);
      }
    });
  }

  async function runResolve(
    tenantId: string,
    rows: TransformedRow[],
    saleIdToContractId: Map<string, string>,
  ): Promise<{ linked: number; missing: number }> {
    const { makeDb, withTenantContext, resolveResoldLinks, AgentCache } = mods;
    return withTenantContext(makeDb(env), tenantId, async (tx) =>
      resolveResoldLinks(
        tx,
        { tenantId, agentCache: new AgentCache(), saleIdToContractId },
        rows,
      ),
    );
  }

  async function getResoldFromContractId(
    tenantId: string,
    externalSaleId: string,
  ): Promise<string | null> {
    const { makeDb, withTenantContext, contracts, eq, and } = mods;
    return withTenantContext(makeDb(env), tenantId, async (tx) => {
      const rows = await tx
        .select({ resoldFromContractId: contracts.resoldFromContractId })
        .from(contracts)
        .where(
          and(
            eq(contracts.tenantId, tenantId),
            eq(contracts.externalSaleId, externalSaleId),
          ),
        )
        .limit(1);
      return rows[0]?.resoldFromContractId ?? null;
    });
  }

  // Track every external id we feed loadRow so afterAll can clean it up.
  function track(tenantId: string, row: TransformedRow): void {
    insertedExternalCustomerIds.push({ tenantId, ext: row.externalCustomerId });
    insertedExternalSaleIds.push({ tenantId, ext: row.externalSaleId });
  }

  it("in-memory map hit: same-batch resold link resolves without DB lookup", async () => {
    const source = makeRow({
      rowNumber: 10,
      externalSaleId: "RES-MEM-source-1",
      externalCustomerId: "RES-MEM-cust-1",
      esiId: "10443720000000101",
    });
    const child = makeRow({
      rowNumber: 11,
      externalSaleId: "RES-MEM-child-1",
      externalCustomerId: "RES-MEM-cust-2",
      esiId: "10443720000000102",
      resoldSaleId: "RES-MEM-source-1",
    });
    track(tenantA, source);
    track(tenantA, child);

    const map = new Map<string, string>();
    await loadAll(tenantA, [source, child], map);
    // Pre-condition: both contracts inserted into the in-memory map by loadAll.
    expect(map.get(source.externalSaleId)).toBeTruthy();
    expect(map.get(child.externalSaleId)).toBeTruthy();
    const sourceId = map.get(source.externalSaleId)!;

    const result = await runResolve(tenantA, [source, child], map);
    expect(result).toEqual({ linked: 1, missing: 0 });
    expect(await getResoldFromContractId(tenantA, child.externalSaleId)).toBe(
      sourceId,
    );
    // Source row had no resoldSaleId → must stay NULL.
    expect(await getResoldFromContractId(tenantA, source.externalSaleId)).toBe(
      null,
    );
  });

  it("DB fallback: source from prior batch resolves via SELECT", async () => {
    const source = makeRow({
      rowNumber: 20,
      externalSaleId: "RES-DB-source-1",
      externalCustomerId: "RES-DB-cust-1",
      esiId: "10443720000000201",
    });
    const child = makeRow({
      rowNumber: 21,
      externalSaleId: "RES-DB-child-1",
      externalCustomerId: "RES-DB-cust-2",
      esiId: "10443720000000202",
      resoldSaleId: "RES-DB-source-1",
    });
    track(tenantA, source);
    track(tenantA, child);

    // Pass 1a: load the source contract in its own "batch". Map captures id.
    const firstBatchMap = new Map<string, string>();
    await loadAll(tenantA, [source], firstBatchMap);
    const sourceId = firstBatchMap.get(source.externalSaleId)!;
    expect(sourceId).toBeTruthy();

    // Pass 1b: a fresh batch where ONLY the child is loaded — the prior
    // contract id is intentionally absent from this map to force the DB path.
    const secondBatchMap = new Map<string, string>();
    await loadAll(tenantA, [child], secondBatchMap);
    expect(secondBatchMap.has(source.externalSaleId)).toBe(false);
    expect(secondBatchMap.get(child.externalSaleId)).toBeTruthy();

    const result = await runResolve(tenantA, [child], secondBatchMap);
    expect(result).toEqual({ linked: 1, missing: 0 });
    expect(await getResoldFromContractId(tenantA, child.externalSaleId)).toBe(
      sourceId,
    );
    // Fallback hit should backfill the map for future rows in the same pass.
    expect(secondBatchMap.get(source.externalSaleId)).toBe(sourceId);
  });

  it("missing source: counter increments, column stays NULL, sink stays empty", async () => {
    const child = makeRow({
      rowNumber: 30,
      externalSaleId: "RES-MISS-child-1",
      externalCustomerId: "RES-MISS-cust-1",
      esiId: "10443720000000301",
      resoldSaleId: "RES-MISS-nonexistent-source",
    });
    track(tenantA, child);

    const map = new Map<string, string>();
    await loadAll(tenantA, [child], map);

    // Quarantine sink instantiated per task instructions. resolveResoldLinks
    // does NOT accept a sink today, so this verifies the side-effect surface
    // remains empty (no rogue writes from the pass-2 code path).
    const sinkPath = join(tmpDir, "missing.jsonl");
    const sink = new mods.QuarantineSink(sinkPath);
    try {
      const result = await runResolve(tenantA, [child], map);
      expect(result).toEqual({ linked: 0, missing: 1 });
    } finally {
      await sink.close();
    }

    expect(await getResoldFromContractId(tenantA, child.externalSaleId)).toBe(
      null,
    );
    const sinkContents = readFileSync(sinkPath, "utf-8");
    expect(sinkContents).toBe("");
  });

  it("tenant isolation: source only in tenant B → tenant A run leaves NULL", async () => {
    const sourceInB = makeRow({
      rowNumber: 40,
      externalSaleId: "RES-XT-source-1",
      externalCustomerId: "RES-XT-cust-B",
      esiId: "10443720000000401",
    });
    const childInA = makeRow({
      rowNumber: 41,
      // Same external_sale_id literal as the tenant-B source — uniqueIndex on
      // contracts is (tenant_id, external_sale_id), so this is allowed and is
      // the exact shape that would trick a cross-tenant SELECT into matching.
      externalSaleId: "RES-XT-source-1",
      externalCustomerId: "RES-XT-cust-A",
      esiId: "10443720000000402",
      resoldSaleId: "RES-XT-source-1",
    });
    track(tenantB, sourceInB);
    track(tenantA, childInA);

    const mapB = new Map<string, string>();
    await loadAll(tenantB, [sourceInB], mapB);
    const sourceIdInB = mapB.get(sourceInB.externalSaleId)!;
    expect(sourceIdInB).toBeTruthy();

    // Tenant A run: only sees its own child, with no in-memory hit for the
    // source. The DB SELECT inside resolveResoldLinks must be scoped to
    // tenant A and find nothing → missing counter increments, column NULL.
    const mapA = new Map<string, string>();
    await loadAll(tenantA, [childInA], mapA);

    const result = await runResolve(tenantA, [childInA], mapA);
    expect(result).toEqual({ linked: 0, missing: 1 });
    expect(await getResoldFromContractId(tenantA, childInA.externalSaleId)).toBe(
      null,
    );
    // Tenant B's contract must be untouched by the tenant-A pass.
    expect(
      await getResoldFromContractId(tenantB, sourceInB.externalSaleId),
    ).toBe(null);
  });

  it("idempotent: second run produces same state, no new links, no new misses", async () => {
    const source = makeRow({
      rowNumber: 50,
      externalSaleId: "RES-IDEM-source-1",
      externalCustomerId: "RES-IDEM-cust-1",
      esiId: "10443720000000501",
    });
    const child = makeRow({
      rowNumber: 51,
      externalSaleId: "RES-IDEM-child-1",
      externalCustomerId: "RES-IDEM-cust-2",
      esiId: "10443720000000502",
      resoldSaleId: "RES-IDEM-source-1",
    });
    // Missing-source row included so the per-call `missing` count covers both
    // the resolved and unresolved arms of the loop on every pass.
    const orphan = makeRow({
      rowNumber: 52,
      externalSaleId: "RES-IDEM-orphan-1",
      externalCustomerId: "RES-IDEM-cust-3",
      esiId: "10443720000000503",
      resoldSaleId: "RES-IDEM-does-not-exist",
    });
    track(tenantA, source);
    track(tenantA, child);
    track(tenantA, orphan);

    const map = new Map<string, string>();
    await loadAll(tenantA, [source, child, orphan], map);
    const sourceId = map.get(source.externalSaleId)!;

    const first = await runResolve(tenantA, [source, child, orphan], map);
    expect(first).toEqual({ linked: 1, missing: 1 });
    const childLinkAfterFirst = await getResoldFromContractId(
      tenantA,
      child.externalSaleId,
    );
    expect(childLinkAfterFirst).toBe(sourceId);
    expect(await getResoldFromContractId(tenantA, orphan.externalSaleId)).toBe(
      null,
    );

    // Second pass: identical inputs. linked count repeats because the UPDATE
    // statement is idempotent (sets the same value); missing repeats for the
    // orphan. The DB state must not drift — same source id, still NULL orphan.
    const second = await runResolve(tenantA, [source, child, orphan], map);
    expect(second).toEqual({ linked: 1, missing: 1 });
    expect(await getResoldFromContractId(tenantA, child.externalSaleId)).toBe(
      sourceId,
    );
    expect(await getResoldFromContractId(tenantA, orphan.externalSaleId)).toBe(
      null,
    );
  });
});
