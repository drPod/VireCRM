import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "../index";
import { customers } from "../schema";
import { withTenantContext } from "../with-tenant-context";

export interface CustomerListItem {
  id: string;
  name: string;
  externalCustomerId: string | null;
  primaryContactName: string | null;
  primaryTitle: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  notes: string | null;
  sicCode: string | null;
  businessType: string | null;
  category: string | null;
  region: string | null;
  county: string | null;
  // Drizzle's `numeric` round-trips as string to preserve precision.
  creditScore: string | null;
  annualRevenue: string | null;
  createdAt: Date;
}

export interface CustomerCreateInput {
  name: string;
  externalCustomerId?: string | null;
  primaryContactName?: string | null;
  primaryTitle?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  notes?: string | null;
  sicCode?: string | null;
  businessType?: string | null;
  category?: string | null;
  region?: string | null;
  county?: string | null;
  creditScore?: string | null;
  annualRevenue?: string | null;
}

export type CustomerUpdateInput = Partial<CustomerCreateInput>;

export interface CustomerListPage {
  items: CustomerListItem[];
  nextCursor: string | null;
}

interface Cursor {
  createdAt: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c));
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(atob(raw)) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string") return null;
    if (typeof parsed.id !== "string") return null;
    // Validate the timestamp is parseable so a malformed cursor doesn't
    // produce a `NaN` comparison that silently returns the whole table.
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

const COLUMNS = {
  id: customers.id,
  name: customers.name,
  externalCustomerId: customers.externalCustomerId,
  primaryContactName: customers.primaryContactName,
  primaryTitle: customers.primaryTitle,
  primaryEmail: customers.primaryEmail,
  primaryPhone: customers.primaryPhone,
  notes: customers.notes,
  sicCode: customers.sicCode,
  businessType: customers.businessType,
  category: customers.category,
  region: customers.region,
  county: customers.county,
  creditScore: customers.creditScore,
  annualRevenue: customers.annualRevenue,
  createdAt: customers.createdAt,
} as const;

export async function listCustomers(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null },
): Promise<CustomerListPage> {
  // Composite tiebreak: (created_at desc, id desc). Without `id` in the cursor
  // simultaneous timestamps would skip rows or return duplicates across pages.
  // Index: `customers_tenant_created_idx (tenant_id, created_at desc, id desc)`.
  //
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // (wrong role connecting via Hyperdrive, policy misconfig, future schema
  // change). It also lets the planner use the composite index with a literal
  // rather than the `auth.jwt()->>tenant_id` function call from RLS.
  return withTenantContext(db, tenantId, async (tx) => {
    const tenantPredicate = eq(customers.tenantId, tenantId);
    const where = opts.cursor
      ? and(
          tenantPredicate,
          or(
            lt(customers.createdAt, new Date(opts.cursor.createdAt)),
            and(
              eq(customers.createdAt, new Date(opts.cursor.createdAt)),
              lt(customers.id, opts.cursor.id),
            ),
          ),
        )
      : tenantPredicate;

    const rows = await tx
      .select(COLUMNS)
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return { items, nextCursor };
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

export async function createCustomer(
  db: Db,
  tenantId: string,
  input: CustomerCreateInput,
): Promise<CustomerListItem> {
  // Force tenantId from handler arg — never trust caller-supplied tenant. Zod
  // `.strict()` on the route already rejects the key, this is defense in depth.
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(customers)
      .values({ ...input, tenantId })
      .returning(COLUMNS);
    return rows[0]!;
  });
}

export async function updateCustomer(
  db: Db,
  tenantId: string,
  customerId: string,
  input: CustomerUpdateInput,
): Promise<CustomerListItem | null> {
  // Drizzle's `set()` accepts undefined per-key and skips those columns — but
  // an entirely empty patch produces `UPDATE customers SET WHERE …`, which is a
  // syntax error. Short-circuit to a plain existence check so PATCH /:id with
  // `{}` still returns 404-vs-200 correctly.
  const hasAnyField = Object.values(input).some((v) => v !== undefined);
  if (!hasAnyField) return getCustomerById(db, tenantId, customerId);

  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .update(customers)
      .set({ ...input, updatedAt: sql`now()` })
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteCustomer(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
      .returning({ id: customers.id });
    return rows.length > 0;
  });
}
