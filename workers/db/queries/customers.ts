import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../index";
import { customers } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { buildNextCursor, type Cursor, keysetWhere } from "./_pagination";

export interface CustomerListItem {
  id: string;
  name: string;
  externalCustomerId: string | null;
  primaryContactName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  createdAt: Date;
}

export interface CustomerListPage {
  items: CustomerListItem[];
  nextCursor: string | null;
}

const COLUMNS = {
  id: customers.id,
  name: customers.name,
  externalCustomerId: customers.externalCustomerId,
  primaryContactName: customers.primaryContactName,
  primaryEmail: customers.primaryEmail,
  primaryPhone: customers.primaryPhone,
  createdAt: customers.createdAt,
} as const;

export async function listCustomers(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null },
): Promise<CustomerListPage> {
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role connecting via Hyperdrive, policy misconfig, future schema
  // change). It also lets the planner use the composite index
  // `customers_tenant_created_idx (tenant_id, created_at desc, id desc)` with a
  // literal rather than the `auth.jwt()->>tenant_id` function call from RLS.
  return withTenantContext(db, tenantId, async (tx) => {
    const tenantPredicate = eq(customers.tenantId, tenantId);
    const where = opts.cursor
      ? and(tenantPredicate, keysetWhere(COLUMNS, opts.cursor))
      : tenantPredicate;

    const rows = await tx
      .select(COLUMNS)
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(opts.limit + 1);

    return buildNextCursor(rows, opts.limit);
  });
}

export async function getCustomerById(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<CustomerListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
      .limit(1);
    return rows[0] ?? null;
  });
}
