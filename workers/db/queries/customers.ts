import { and, desc, eq, lt, or } from "drizzle-orm";
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
  return withTenantContext(db, tenantId, async (tx) => {
    const where = opts.cursor
      ? or(
          lt(customers.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(customers.createdAt, new Date(opts.cursor.createdAt)),
            lt(customers.id, opts.cursor.id),
          ),
        )
      : undefined;

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
      .where(eq(customers.id, customerId))
      .limit(1);
    return rows[0] ?? null;
  });
}
