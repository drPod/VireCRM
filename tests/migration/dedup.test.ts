import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AgentCache,
  addressKey,
  findServiceAddressByKey,
  normalizeAgentName,
} from "../../scripts/migrate-xlsx/dedup";
import type { TransformedRow } from "../../scripts/migrate-xlsx/types";
import { getSeededTenantIds, hasTestDb } from "../setup";

const UUID_RE = /^[0-9a-f-]{36}$/;

const ALL_NULL_ADDRESS = {
  streetNo: null,
  streetName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zip: null,
} as const;

// Minimal TransformedRow fixture. addressKey only reads the 7 address fields;
// rest filled with nulls/defaults to satisfy the type without affecting tests.
function makeRow(overrides: Partial<TransformedRow> = {}): TransformedRow {
  return {
    rowNumber: 1,
    externalSaleId: "EXT-1",
    externalCustomerId: "CUST-1",
    customerName: "Acme",
    esiId: "1044372000000000000",
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

describe("addressKey — variants collapse", () => {
  // Same physical address, different formatting → same key. Normalize strips
  // case + whitespace + punctuation, so all variants must dedup.
  const base = {
    streetNo: "123",
    streetName: "Main St",
    addressLine1: null,
    addressLine2: null,
    city: "Houston",
    state: "TX",
    zip: "77001",
  };

  it("case differences collapse", () => {
    expect(addressKey(makeRow(base))).toBe(addressKey(makeRow({ ...base, city: "HOUSTON" })));
  });

  it("internal double-space collapses", () => {
    expect(addressKey(makeRow(base))).toBe(
      addressKey(makeRow({ ...base, streetName: "Main  St" })),
    );
  });

  it("trailing period collapses", () => {
    expect(addressKey(makeRow(base))).toBe(
      addressKey(makeRow({ ...base, streetName: "Main St." })),
    );
  });

  it("leading/trailing whitespace collapses", () => {
    expect(addressKey(makeRow(base))).toBe(addressKey(makeRow({ ...base, city: "  Houston  " })));
  });

  it("null vs empty string in a segment produce same key", () => {
    expect(addressKey(makeRow({ ...base, addressLine2: null }))).toBe(
      addressKey(makeRow({ ...base, addressLine2: "" })),
    );
  });

  it("all-null address returns empty string (treated as 'no address')", () => {
    // Empty string triggers load.ts short-circuit → INSERT a fresh row instead
    // of dedup-collapsing every null-address row together via the SQL match.
    expect(addressKey(makeRow(ALL_NULL_ADDRESS))).toBe("");
  });

  it("all-empty-string address returns empty string", () => {
    const allEmpty = {
      streetNo: "",
      streetName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
    };
    expect(addressKey(makeRow(allEmpty))).toBe("");
  });

  it("single non-null component → non-empty key", () => {
    expect(addressKey(makeRow({ ...ALL_NULL_ADDRESS, zip: "77001" }))).not.toBe("");
  });
});

describe("addressKey — distinct addresses produce distinct keys", () => {
  const base = {
    streetNo: "123",
    streetName: "Main St",
    addressLine1: null,
    addressLine2: null,
    city: "Houston",
    state: "TX",
    zip: "77001",
  };

  it("different streetNo → different keys", () => {
    expect(addressKey(makeRow(base))).not.toBe(addressKey(makeRow({ ...base, streetNo: "456" })));
  });

  it("different city → different keys", () => {
    expect(addressKey(makeRow(base))).not.toBe(addressKey(makeRow({ ...base, city: "Dallas" })));
  });

  it("different zip → different keys", () => {
    expect(addressKey(makeRow(base))).not.toBe(addressKey(makeRow({ ...base, zip: "77002" })));
  });

  it("different state → different keys", () => {
    expect(addressKey(makeRow(base))).not.toBe(addressKey(makeRow({ ...base, state: "OK" })));
  });
});

describe("normalizeAgentName", () => {
  it("collapses case + whitespace + trim across common variants", () => {
    const canonical = "john smith";
    expect(normalizeAgentName("John Smith")).toBe(canonical);
    expect(normalizeAgentName("john smith")).toBe(canonical);
    expect(normalizeAgentName("John  Smith ")).toBe(canonical);
    expect(normalizeAgentName(" JOHN SMITH ")).toBe(canonical);
  });

  it("empty string stays empty", () => {
    expect(normalizeAgentName("")).toBe("");
  });

  it("whitespace-only collapses to empty", () => {
    expect(normalizeAgentName("   ")).toBe("");
  });

  it("tab + newline collapse to single space", () => {
    expect(normalizeAgentName("John\tSmith")).toBe("john smith");
    expect(normalizeAgentName("John\nSmith")).toBe("john smith");
  });
});

describe("AgentCache.get — pure lookup, no DB", () => {
  it("fresh instance returns null for any name", () => {
    expect(new AgentCache().get("anyone")).toBe(null);
  });

  it("null input returns null", () => {
    expect(new AgentCache().get(null)).toBe(null);
  });

  it("empty string returns null", () => {
    expect(new AgentCache().get("")).toBe(null);
  });

  it("whitespace-only returns null", () => {
    expect(new AgentCache().get("   ")).toBe(null);
  });

  it("never throws on weird input", () => {
    const cache = new AgentCache();
    expect(() => cache.get("\t\n  ")).not.toThrow();
    expect(() => cache.get("!@#$%^&*()")).not.toThrow();
    expect(() => cache.get(null)).not.toThrow();
  });

  it("initial counters are zero", () => {
    const cache = new AgentCache();
    expect(cache.insertedCount).toBe(0);
    expect(cache.reusedCount).toBe(0);
  });
});

// DB-gated. prewarm needs real Postgres; skipped when TEST_DB_URL unset.
// Test connection has RLS engaged (unlike the script's service_role path);
// withTenantContext sets request.jwt.claims so the agents policy admits the
// insert/select.
describe.skipIf(!hasTestDb)("AgentCache.prewarm — DB-gated", () => {
  // Lazy-import inside beforeAll — skip path shouldn't pay the drizzle load.
  let mods: {
    makeDb: typeof import("../../workers/db")["makeDb"];
    agents: typeof import("../../workers/db/schema")["agents"];
    withTenantContext: typeof import("../../workers/db/with-tenant-context")["withTenantContext"];
    eq: typeof import("drizzle-orm")["eq"];
    and: typeof import("drizzle-orm")["and"];
    inArray: typeof import("drizzle-orm")["inArray"];
  };
  let tenantA: string;
  const insertedNames: string[] = [];

  beforeAll(async () => {
    const [dbMod, schemaMod, ctxMod, orm, ids] = await Promise.all([
      import("../../workers/db"),
      import("../../workers/db/schema"),
      import("../../workers/db/with-tenant-context"),
      import("drizzle-orm"),
      getSeededTenantIds(),
    ]);
    mods = {
      makeDb: dbMod.makeDb,
      agents: schemaMod.agents,
      withTenantContext: ctxMod.withTenantContext,
      eq: orm.eq,
      and: orm.and,
      inArray: orm.inArray,
    };
    tenantA = ids.a;
  });

  async function deleteAgents(names: string[]): Promise<void> {
    if (names.length === 0) return;
    const { makeDb, agents, withTenantContext, eq, and, inArray } = mods;
    await withTenantContext(makeDb(env), tenantA, async (tx) => {
      await tx.delete(agents).where(and(eq(agents.tenantId, tenantA), inArray(agents.name, names)));
    });
  }

  async function prewarmInTenantCtx(cache: AgentCache, names: Iterable<string>): Promise<void> {
    await mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
      await cache.prewarm(tx, tenantA, new Set(names));
    });
  }

  afterAll(async () => {
    await deleteAgents(insertedNames);
  });

  it("inserts from empty: 2 names → 2 inserted, 0 reused", async () => {
    const names = ["dedup-test-Alice-1", "dedup-test-Bob-1"];
    insertedNames.push(...names);
    await deleteAgents(names);

    const cache = new AgentCache();
    await prewarmInTenantCtx(cache, names);

    expect(cache.insertedCount).toBe(2);
    expect(cache.reusedCount).toBe(0);
    expect(cache.get(names[0]!)).toMatch(UUID_RE);
    expect(cache.get(names[1]!)).toMatch(UUID_RE);
  });

  it("reuses existing rows: pre-insert + prewarm → mixed counts", async () => {
    const carolName = "dedup-test-Carol-2";
    const daveName = "dedup-test-Dave-2";
    insertedNames.push(carolName, daveName);
    await deleteAgents([carolName, daveName]);

    const { makeDb, agents, withTenantContext } = mods;
    // Pre-insert Carol directly so prewarm sees her as existing.
    const carolId = await withTenantContext(makeDb(env), tenantA, async (tx) => {
      const rows = await tx
        .insert(agents)
        .values({ tenantId: tenantA, name: carolName })
        .returning({ id: agents.id });
      return rows[0]!.id;
    });

    const cache = new AgentCache();
    await prewarmInTenantCtx(cache, [carolName, daveName]);

    expect(cache.insertedCount).toBe(1);
    expect(cache.reusedCount).toBe(1);
    expect(cache.get(carolName)).toBe(carolId);
    expect(cache.get(daveName)).toMatch(UUID_RE);
    expect(cache.get(daveName)).not.toBe(carolId);
  });

  it("case + whitespace variants collapse to single insert", async () => {
    // 3 surface forms → 1 canonical key → 1 row.
    const baseName = "dedup-test-Variant-3 Smith";
    const variants = [baseName, baseName.toUpperCase(), baseName.toLowerCase()];
    insertedNames.push(baseName);
    await deleteAgents(variants);

    const cache = new AgentCache();
    await prewarmInTenantCtx(cache, variants);

    expect(cache.insertedCount).toBe(1);
    const id = cache.get(baseName);
    expect(id).toMatch(UUID_RE);
    expect(cache.get(baseName.toUpperCase())).toBe(id);
    expect(cache.get(baseName.toLowerCase())).toBe(id);
  });

  it("skips empty + whitespace-only names silently", async () => {
    const realName = "dedup-test-RealName-4";
    insertedNames.push(realName);
    await deleteAgents([realName]);

    const cache = new AgentCache();
    await prewarmInTenantCtx(cache, ["", "   ", realName]);

    expect(cache.insertedCount).toBe(1);
    expect(cache.get(realName)).toMatch(UUID_RE);
  });

  it("idempotent re-prewarm: second call sees rows as reused", async () => {
    const eveName = "dedup-test-Eve-5";
    insertedNames.push(eveName);
    await deleteAgents([eveName]);

    const first = new AgentCache();
    await prewarmInTenantCtx(first, [eveName]);
    expect(first.insertedCount).toBe(1);
    const firstId = first.get(eveName);
    expect(firstId).toMatch(UUID_RE);

    // Fresh cache, same name → must reuse the committed row.
    const second = new AgentCache();
    await prewarmInTenantCtx(second, [eveName]);
    expect(second.insertedCount).toBe(0);
    expect(second.reusedCount).toBe(1);
    expect(second.get(eveName)).toBe(firstId);
  });
});

// DB-gated. Pins SQL normalize ↔ TS normalize parity. load.ts computes the
// key TS-side then queries SQL-side rows — any drift = silent dedup misses.
describe.skipIf(!hasTestDb)("findServiceAddressByKey — DB-gated", () => {
  let mods: {
    makeDb: typeof import("../../workers/db")["makeDb"];
    serviceAddresses: typeof import("../../workers/db/schema")["serviceAddresses"];
    customers: typeof import("../../workers/db/schema")["customers"];
    withTenantContext: typeof import("../../workers/db/with-tenant-context")["withTenantContext"];
    eq: typeof import("drizzle-orm")["eq"];
    and: typeof import("drizzle-orm")["and"];
  };
  let tenantA: string;
  let customerId: string;
  const TEST_CUSTOMER_EXT = "dedup-test-findAddr-customer";

  // Insert a service_address from the 7 address fields of a TransformedRow,
  // return its id. Used 3× below — extracted to keep the test bodies focused
  // on the query-side assertion.
  async function insertServiceAddress(row: TransformedRow): Promise<string> {
    return mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
      const rows = await tx
        .insert(mods.serviceAddresses)
        .values({
          tenantId: tenantA,
          customerId,
          streetNo: row.streetNo,
          streetName: row.streetName,
          city: row.city,
          state: row.state,
          zip: row.zip,
        })
        .returning({ id: mods.serviceAddresses.id });
      return rows[0]!.id;
    });
  }

  async function findByKey(cId: string, key: string): Promise<string | null> {
    return mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) =>
      findServiceAddressByKey(tx, tenantA, cId, key),
    );
  }

  beforeAll(async () => {
    const [dbMod, schemaMod, ctxMod, orm, ids] = await Promise.all([
      import("../../workers/db"),
      import("../../workers/db/schema"),
      import("../../workers/db/with-tenant-context"),
      import("drizzle-orm"),
      getSeededTenantIds(),
    ]);
    mods = {
      makeDb: dbMod.makeDb,
      serviceAddresses: schemaMod.serviceAddresses,
      customers: schemaMod.customers,
      withTenantContext: ctxMod.withTenantContext,
      eq: orm.eq,
      and: orm.and,
    };
    tenantA = ids.a;

    // Dedicated test customer = isolated FK target, won't collide with seeds.
    customerId = await mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
      const existing = await tx
        .select({ id: mods.customers.id })
        .from(mods.customers)
        .where(
          mods.and(
            mods.eq(mods.customers.tenantId, tenantA),
            mods.eq(mods.customers.externalCustomerId, TEST_CUSTOMER_EXT),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0].id;
      const inserted = await tx
        .insert(mods.customers)
        .values({
          tenantId: tenantA,
          name: "dedup-test-findAddr",
          externalCustomerId: TEST_CUSTOMER_EXT,
        })
        .returning({ id: mods.customers.id });
      return inserted[0]!.id;
    });
  });

  afterAll(async () => {
    // service_addresses cascades from customer; one delete drops both.
    await mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
      await tx
        .delete(mods.customers)
        .where(
          mods.and(
            mods.eq(mods.customers.tenantId, tenantA),
            mods.eq(mods.customers.externalCustomerId, TEST_CUSTOMER_EXT),
          ),
        );
    });
  });

  it("finds a matching address by key (canonical form)", async () => {
    const row = makeRow({
      streetNo: "100",
      streetName: "Test Lane",
      city: "Austin",
      state: "TX",
      zip: "78701",
    });
    const insertedId = await insertServiceAddress(row);
    expect(await findByKey(customerId, addressKey(row))).toBe(insertedId);
  });

  it("SQL normalize matches TS normalize on whitespace + case variants", async () => {
    const canonical = makeRow({
      streetNo: "200",
      streetName: "Main St",
      city: "Houston",
      state: "TX",
      zip: "77002",
    });
    const insertedId = await insertServiceAddress(canonical);

    const variants = [
      canonical,
      makeRow({ ...canonical, streetName: "main st" }),
      makeRow({ ...canonical, streetName: "Main  St" }),
      makeRow({ ...canonical, streetName: "Main St." }),
      makeRow({ ...canonical, city: "  Houston  " }),
    ];

    for (const v of variants) {
      expect(await findByKey(customerId, addressKey(v))).toBe(insertedId);
    }
  });

  it("returns null when no row matches the key", async () => {
    const row = makeRow({
      streetNo: "999",
      streetName: "Nonexistent Way",
      city: "Nowhere",
      state: "ZZ",
      zip: "00000",
    });
    expect(await findByKey(customerId, addressKey(row))).toBe(null);
  });

  it("scopes to (tenant, customer): does not return matches from another customer", async () => {
    const row = makeRow({
      streetNo: "300",
      streetName: "Shared Dr",
      city: "Plano",
      state: "TX",
      zip: "75024",
    });
    await insertServiceAddress(row);

    const otherCustomerExt = "dedup-test-findAddr-other";
    const otherCustomerId = await mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
      const inserted = await tx
        .insert(mods.customers)
        .values({
          tenantId: tenantA,
          name: "dedup-test-findAddr-other",
          externalCustomerId: otherCustomerExt,
        })
        .returning({ id: mods.customers.id });
      return inserted[0]!.id;
    });

    try {
      expect(await findByKey(otherCustomerId, addressKey(row))).toBe(null);
    } finally {
      await mods.withTenantContext(mods.makeDb(env), tenantA, async (tx) => {
        await tx
          .delete(mods.customers)
          .where(
            mods.and(
              mods.eq(mods.customers.tenantId, tenantA),
              mods.eq(mods.customers.externalCustomerId, otherCustomerExt),
            ),
          );
      });
    }
  });
});
