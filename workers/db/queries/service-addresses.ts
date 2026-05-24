import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";

export interface ServiceAddressItem {
  id: string;
  customerId: string;
  streetNo: string | null;
  streetName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  govtArea: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceAddressListPage {
  items: ServiceAddressItem[];
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
  id: serviceAddresses.id,
  customerId: serviceAddresses.customerId,
  streetNo: serviceAddresses.streetNo,
  streetName: serviceAddresses.streetName,
  addressLine1: serviceAddresses.addressLine1,
  addressLine2: serviceAddresses.addressLine2,
  city: serviceAddresses.city,
  state: serviceAddresses.state,
  zip: serviceAddresses.zip,
  county: serviceAddresses.county,
  govtArea: serviceAddresses.govtArea,
  createdAt: serviceAddresses.createdAt,
  updatedAt: serviceAddresses.updatedAt,
} as const;

export async function listServiceAddresses(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; customerId?: string },
): Promise<ServiceAddressListPage> {
  // Composite tiebreak: (created_at desc, id desc). Same pattern as customers —
  // see `listCustomers` for why `id` must be in the cursor.
  //
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps and
  // lets the planner pick `service_addresses_tenant_idx` / `_tenant_customer_idx`
  // against a literal value instead of the opaque `auth.jwt()->>tenant_id` call.
  return withTenantContext(db, tenantId, async (tx) => {
    const tenantPredicate = eq(serviceAddresses.tenantId, tenantId);
    const customerPredicate = opts.customerId
      ? eq(serviceAddresses.customerId, opts.customerId)
      : undefined;
    const cursorPredicate = opts.cursor
      ? or(
          lt(serviceAddresses.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(serviceAddresses.createdAt, new Date(opts.cursor.createdAt)),
            lt(serviceAddresses.id, opts.cursor.id),
          ),
        )
      : undefined;
    const where = and(tenantPredicate, customerPredicate, cursorPredicate);

    const rows = await tx
      .select(COLUMNS)
      .from(serviceAddresses)
      .where(where)
      .orderBy(desc(serviceAddresses.createdAt), desc(serviceAddresses.id))
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

export async function getServiceAddressById(
  db: Db,
  tenantId: string,
  id: string,
): Promise<ServiceAddressItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(serviceAddresses)
      .where(
        and(eq(serviceAddresses.tenantId, tenantId), eq(serviceAddresses.id, id)),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export interface ServiceAddressCreate {
  customerId: string;
  streetNo?: string | null;
  streetName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  govtArea?: string | null;
}

export async function createServiceAddress(
  db: Db,
  tenantId: string,
  input: ServiceAddressCreate,
): Promise<ServiceAddressItem> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(serviceAddresses)
      .values({ ...input, tenantId })
      .returning(COLUMNS);
    // INSERT … RETURNING always emits the new row; the `!` is the safe
    // narrowing, not a fallback for missing data.
    return rows[0]!;
  });
}

export type ServiceAddressUpdate = Partial<Omit<ServiceAddressCreate, "customerId">>;

export async function updateServiceAddress(
  db: Db,
  tenantId: string,
  id: string,
  input: ServiceAddressUpdate,
): Promise<ServiceAddressItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .update(serviceAddresses)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(serviceAddresses.tenantId, tenantId), eq(serviceAddresses.id, id)),
      )
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteServiceAddress(
  db: Db,
  tenantId: string,
  id: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(serviceAddresses)
      .where(
        and(eq(serviceAddresses.tenantId, tenantId), eq(serviceAddresses.id, id)),
      )
      .returning({ id: serviceAddresses.id });
    return rows.length > 0;
  });
}
