import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "../index";
import { customers } from "../schema";
import { withTenantContext } from "../with-tenant-context";

export interface CustomerListItem {
  id: string;
  name: string;
  externalCustomerId: string | null;
  primaryContactName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  createdAt: Date;
}

export interface CustomerCreateInput {
  name: string;
  externalCustomerId?: string | null;
  primaryContactName?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
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
  primaryEmail: customers.primaryEmail,
  primaryPhone: customers.primaryPhone,
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
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(customers)
      .values({
        // tenantId from arg, never from caller input — defense in depth atop
        // the Zod schema which already omits the key.
        tenantId,
        name: input.name,
        externalCustomerId: input.externalCustomerId ?? null,
        primaryContactName: input.primaryContactName ?? null,
        primaryEmail: input.primaryEmail ?? null,
        primaryPhone: input.primaryPhone ?? null,
      })
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
  return withTenantContext(db, tenantId, async (tx) => {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.externalCustomerId !== undefined) patch.externalCustomerId = input.externalCustomerId;
    if (input.primaryContactName !== undefined) patch.primaryContactName = input.primaryContactName;
    if (input.primaryEmail !== undefined) patch.primaryEmail = input.primaryEmail;
    if (input.primaryPhone !== undefined) patch.primaryPhone = input.primaryPhone;

    // No patchable fields → just return the current row so a no-op PATCH still
    // surfaces 404 vs 200 correctly.
    if (Object.keys(patch).length === 0) {
      const rows = await tx
        .select(COLUMNS)
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
        .limit(1);
      return rows[0] ?? null;
    }

    patch.updatedAt = sql`now()`;

    const rows = await tx
      .update(customers)
      .set(patch)
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
