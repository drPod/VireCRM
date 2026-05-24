import { env } from "cloudflare:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Db, makeDb } from "../workers/db";
import {
  agents,
  aggregatorPayouts,
  commissionStatements,
  contracts,
  customers,
  deals,
  esis,
  loas,
  serviceAddresses,
} from "../workers/db/schema";
import { withTenantContext } from "../workers/db/with-tenant-context";
import { getSeededTenantIds, hasTestDb } from "./setup";

// FOR ALL policy drift guard. Every domain table carries a single
// `tenant_isolation` policy declared `FOR ALL TO authenticated` with a
// matching USING + WITH CHECK clause. Drop FOR ALL → FOR SELECT, or drop
// WITH CHECK, and tenant A could forge writes against tenant B.
//
// IMPORTANT (see workers/db/with-tenant-context.ts header): Hyperdrive's
// connection uses the `postgres` role which is BYPASSRLS — outside
// `withTenantContext` RLS never fires. The meta-test below confirms the
// JWT claim is actually set inside the wrapper to defend against silent
// pass-by-default if the wrapper ever regresses.

// Heterogeneous schema-table + drizzle tx types — every table-under-test has
// distinct row + column types, and writing each branch out adds noise without
// catching bugs.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type AnyTable = any;
// biome-ignore lint/suspicious/noExplicitAny: see AnyTable
type AnyTx = any;
type AnyRecord = Record<string, unknown>;

interface TableUnderTest {
  name: string;
  table: AnyTable;
  // Buckets in `inserted` we should clean up rows from for THIS spec's
  // cross-tenant tests. Always includes the table itself, plus any parent
  // tables seeded by `seedPrereqs`.
  seedPrereqs: (tx: AnyTx, tenantB: string) => Promise<AnyRecord>;
  makeSeedRow: (forgeTenantId: string, prereqs: AnyRecord, suffix: string) => AnyRecord;
}

let tenantA: string;
let tenantB: string;

// Per-table cleanup buckets. Reverse-FK order at afterAll time keeps the
// `ON DELETE restrict` constraint on tenant_id from blocking us.
const inserted = {
  aggregatorPayouts: [] as string[],
  commissionStatements: [] as string[],
  loas: [] as string[],
  deals: [] as string[],
  contracts: [] as string[],
  esis: [] as string[],
  serviceAddresses: [] as string[],
  customers: [] as string[],
  agents: [] as string[],
};

// Unique suffix per test run so reruns don't collide on unique indexes
// (e.g. `customers_tenant_external_idx`, `esis_tenant_esi_id_idx`).
const RUN_ID = `rls-write-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let counter = 0;
const nextSuffix = () => `${RUN_ID}-${++counter}`;

// ESI ID space is 17-22 digits with Oncor's `1044372` prefix; uniqueness
// scoped per (tenant_id, esi_id). Truncate so we stay in spec.
const nextEsiId = () => `1044372${Date.now()}${counter}`.slice(0, 22);

// FK chain seeders. Composing these keeps the table specs declarative;
// each seeder appends to the right cleanup bucket inline.
async function seedCustomer(tx: AnyTx, tenantB: string): Promise<string> {
  const [r] = await tx
    .insert(customers)
    .values({ tenantId: tenantB, name: `cust-${nextSuffix()}` })
    .returning({ id: customers.id });
  inserted.customers.push(r.id);
  return r.id;
}

async function seedServiceAddress(tx: AnyTx, tenantB: string): Promise<string> {
  const customerId = await seedCustomer(tx, tenantB);
  const [r] = await tx
    .insert(serviceAddresses)
    .values({ tenantId: tenantB, customerId, addressLine1: `sa-${nextSuffix()}` })
    .returning({ id: serviceAddresses.id });
  inserted.serviceAddresses.push(r.id);
  return r.id;
}

async function seedEsi(tx: AnyTx, tenantB: string): Promise<string> {
  const serviceAddressId = await seedServiceAddress(tx, tenantB);
  const [r] = await tx
    .insert(esis)
    .values({ tenantId: tenantB, serviceAddressId, esiId: nextEsiId() })
    .returning({ id: esis.id });
  inserted.esis.push(r.id);
  return r.id;
}

async function seedContract(tx: AnyTx, tenantB: string): Promise<string> {
  const esiId = await seedEsi(tx, tenantB);
  const [r] = await tx
    .insert(contracts)
    .values({
      tenantId: tenantB,
      esiId,
      externalSaleId: `ct-${nextSuffix()}`,
    })
    .returning({ id: contracts.id });
  inserted.contracts.push(r.id);
  return r.id;
}

const tablesUnderTest: TableUnderTest[] = [
  {
    name: "agents",
    table: agents,
    seedPrereqs: async () => ({}),
    makeSeedRow: (forgeTenantId, _p, suffix) => ({
      tenantId: forgeTenantId,
      name: `agent-${suffix}`,
    }),
  },
  {
    name: "customers",
    table: customers,
    seedPrereqs: async () => ({}),
    makeSeedRow: (forgeTenantId, _p, suffix) => ({
      tenantId: forgeTenantId,
      name: `customer-${suffix}`,
    }),
  },
  {
    name: "service_addresses",
    table: serviceAddresses,
    seedPrereqs: async (tx, tB) => ({ customerId: await seedCustomer(tx, tB) }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      customerId: p.customerId,
      addressLine1: `street-${suffix}`,
    }),
  },
  {
    name: "esis",
    table: esis,
    seedPrereqs: async (tx, tB) => ({
      serviceAddressId: await seedServiceAddress(tx, tB),
    }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      serviceAddressId: p.serviceAddressId,
      esiId: nextEsiId(),
      physicalMeterSerial: `serial-${suffix}`,
    }),
  },
  {
    name: "contracts",
    table: contracts,
    seedPrereqs: async (tx, tB) => ({ esiId: await seedEsi(tx, tB) }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      esiId: p.esiId,
      supplier: `rep-${suffix}`,
      externalSaleId: `ext-${suffix}`,
    }),
  },
  {
    name: "deals",
    table: deals,
    seedPrereqs: async (tx, tB) => ({ customerId: await seedCustomer(tx, tB) }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      customerId: p.customerId,
      externalSaleId: `deal-ext-${suffix}`,
      stage: "Lead",
    }),
  },
  {
    name: "loas",
    table: loas,
    seedPrereqs: async (tx, tB) => ({ customerId: await seedCustomer(tx, tB) }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      customerId: p.customerId,
      pdfStoragePath: `loas/${suffix}.pdf`,
    }),
  },
  {
    name: "commission_statements",
    table: commissionStatements,
    seedPrereqs: async (tx, tB) => ({ contractId: await seedContract(tx, tB) }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      contractId: p.contractId,
      supplier: `cs-supplier-${suffix}`,
    }),
  },
  {
    name: "aggregator_payouts",
    table: aggregatorPayouts,
    seedPrereqs: async (tx, tB) => ({ contractId: await seedContract(tx, tB) }),
    makeSeedRow: (forgeTenantId, p, suffix) => ({
      tenantId: forgeTenantId,
      contractId: p.contractId,
      aggregatorName: `agg-${suffix}`,
    }),
  },
];

// Map table_name → cleanup bucket so each spec can register its seed-row
// ids without a per-table switch.
const insertedBucketByName: Record<string, string[]> = {
  agents: inserted.agents,
  customers: inserted.customers,
  service_addresses: inserted.serviceAddresses,
  esis: inserted.esis,
  contracts: inserted.contracts,
  deals: inserted.deals,
  loas: inserted.loas,
  commission_statements: inserted.commissionStatements,
  aggregator_payouts: inserted.aggregatorPayouts,
};

async function seedRowAsTenantB(
  db: Db,
  spec: TableUnderTest,
  prereqs: AnyRecord,
  suffix: string,
): Promise<string> {
  const seededId = await withTenantContext(db, tenantB, async (tx) => {
    const [r] = await tx
      .insert(spec.table)
      .values(spec.makeSeedRow(tenantB, prereqs, suffix))
      .returning({ id: spec.table.id });
    return r.id as string;
  });
  const bucket = insertedBucketByName[spec.name];
  if (bucket) bucket.push(seededId);
  return seededId;
}

describe.skipIf(!hasTestDb)("RLS write-path FOR ALL policy drift guard", () => {
  beforeAll(async () => {
    const ids = await getSeededTenantIds();
    tenantA = ids.a;
    tenantB = ids.b;
  });

  afterAll(async () => {
    // Cleanup runs as `postgres` (BYPASSRLS) — outside withTenantContext so
    // RLS doesn't filter our own seed rows out. Reverse-FK order matters:
    // ON DELETE restrict from tenant_id and from contracts blocks deletion
    // of parents while children exist.
    const db = makeDb(env);
    const deleteOrder: Array<[string[], AnyTable]> = [
      [inserted.aggregatorPayouts, aggregatorPayouts],
      [inserted.commissionStatements, commissionStatements],
      [inserted.loas, loas],
      [inserted.deals, deals],
      [inserted.contracts, contracts],
      [inserted.esis, esis],
      [inserted.serviceAddresses, serviceAddresses],
      [inserted.customers, customers],
      [inserted.agents, agents],
    ];
    for (const [ids, table] of deleteOrder) {
      if (ids.length > 0) {
        await db.delete(table).where(inArray(table.id, ids));
      }
    }
  });

  // Meta-test defends against silent pass-by-default: if `withTenantContext`
  // ever stops setting the claim, every cross-tenant test below would pass
  // because BYPASSRLS lets the writes through.
  it("meta: auth.jwt() ->> 'tenant_id' is non-NULL inside withTenantContext", async () => {
    const db = makeDb(env);
    const claim = await withTenantContext(db, tenantA, async (tx) => {
      const rows = (await tx.execute(
        sql`SELECT (auth.jwt() ->> 'tenant_id') AS tenant_id`,
      )) as unknown as Array<{ tenant_id: string | null }>;
      return rows[0]?.tenant_id;
    });
    expect(claim).toBe(tenantA);
  });

  describe.each(tablesUnderTest)("$name", (spec) => {
    it("INSERT cross-tenant rejected by WITH CHECK", async () => {
      const db = makeDb(env);
      const prereqs = await withTenantContext(db, tenantB, async (tx) =>
        spec.seedPrereqs(tx, tenantB),
      );

      // Drizzle wraps the underlying postgres-js error as `Failed query:
      // ...`; the real PostgresError sits on `.cause` with `code: "42501"`
      // and the "new row violates row-level security policy" message.
      let caught: unknown;
      try {
        await withTenantContext(db, tenantA, async (tx) => {
          await tx.insert(spec.table).values(spec.makeSeedRow(tenantB, prereqs, nextSuffix()));
        });
      } catch (e) {
        caught = e;
      }
      const cause = (caught as { cause?: { code?: string; message?: string } })?.cause;
      expect(cause?.code).toBe("42501");
      expect(cause?.message).toMatch(/row-level security/i);
    });

    it("UPDATE cross-tenant hidden (0 rows affected, row unchanged)", async () => {
      const db = makeDb(env);
      const suffix = nextSuffix();
      const prereqs = await withTenantContext(db, tenantB, async (tx) =>
        spec.seedPrereqs(tx, tenantB),
      );
      const seededId = await seedRowAsTenantB(db, spec, prereqs, suffix);

      const beforeUpdatedAt = await withTenantContext(db, tenantB, async (tx) => {
        const [r] = await tx
          .select({ updatedAt: spec.table.updatedAt })
          .from(spec.table)
          .where(eq(spec.table.id, seededId));
        return r?.updatedAt as Date | undefined;
      });

      // UPDATE under tenant A: SQL succeeds (no error) but RLS USING hides
      // the row so 0 rows match.
      const sentinelUpdatedAt = new Date("2099-01-01T00:00:00.000Z");
      await withTenantContext(db, tenantA, async (tx) => {
        await tx
          .update(spec.table)
          // Set every table's `updated_at` instead of a column-specific
          // value — keeps this loop generic across all 9 tables.
          .set({ updatedAt: sentinelUpdatedAt })
          .where(eq(spec.table.id, seededId));
      });

      const after = await withTenantContext(db, tenantB, async (tx) => {
        const [r] = await tx
          .select({ id: spec.table.id, updatedAt: spec.table.updatedAt })
          .from(spec.table)
          .where(eq(spec.table.id, seededId));
        return r as { id: string; updatedAt: Date } | undefined;
      });

      expect(after?.id).toBe(seededId);
      expect(after?.updatedAt?.getTime()).toBe(beforeUpdatedAt?.getTime());
      expect(after?.updatedAt?.getTime()).not.toBe(sentinelUpdatedAt.getTime());
    });

    it("DELETE cross-tenant hidden (row still present)", async () => {
      const db = makeDb(env);
      const suffix = nextSuffix();
      const prereqs = await withTenantContext(db, tenantB, async (tx) =>
        spec.seedPrereqs(tx, tenantB),
      );
      const seededId = await seedRowAsTenantB(db, spec, prereqs, suffix);

      await withTenantContext(db, tenantA, async (tx) => {
        await tx.delete(spec.table).where(eq(spec.table.id, seededId));
      });

      const stillThere = await withTenantContext(db, tenantB, async (tx) => {
        const rows = await tx
          .select({ id: spec.table.id })
          .from(spec.table)
          .where(and(eq(spec.table.tenantId, tenantB), eq(spec.table.id, seededId)));
        return rows.length;
      });

      expect(stillThere).toBe(1);
    });
  });

  // Sanity — proves the cross-tenant tests don't pass because writes are
  // uniformly blocked. One table is enough.
  describe("sanity (customers): correct-tenant writes succeed", () => {
    it("UPDATE under matching tenant DOES affect the row", async () => {
      const db = makeDb(env);
      const suffix = nextSuffix();
      const seededId = await withTenantContext(db, tenantB, async (tx) => {
        const [r] = await tx
          .insert(customers)
          .values({ tenantId: tenantB, name: `sanity-update-${suffix}` })
          .returning({ id: customers.id });
        return r.id;
      });
      inserted.customers.push(seededId);

      const newName = `sanity-updated-${suffix}`;
      await withTenantContext(db, tenantB, async (tx) => {
        await tx.update(customers).set({ name: newName }).where(eq(customers.id, seededId));
      });

      const after = await withTenantContext(db, tenantB, async (tx) => {
        const [r] = await tx
          .select({ name: customers.name })
          .from(customers)
          .where(eq(customers.id, seededId));
        return r?.name;
      });

      expect(after).toBe(newName);
    });

    it("DELETE under matching tenant DOES remove the row", async () => {
      const db = makeDb(env);
      const suffix = nextSuffix();
      const seededId = await withTenantContext(db, tenantB, async (tx) => {
        const [r] = await tx
          .insert(customers)
          .values({ tenantId: tenantB, name: `sanity-delete-${suffix}` })
          .returning({ id: customers.id });
        return r.id;
      });
      // Intentionally don't push to cleanup — the test removes it.

      await withTenantContext(db, tenantB, async (tx) => {
        await tx.delete(customers).where(eq(customers.id, seededId));
      });

      const remaining = await withTenantContext(db, tenantB, async (tx) => {
        const rows = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, seededId));
        return rows.length;
      });

      expect(remaining).toBe(0);
    });
  });
});
