import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { customers, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer keeps its single import surface.
export { decodeCursor };

export interface ServiceAddressListItem {
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
}

export interface ServiceAddressListPage {
  items: ServiceAddressListItem[];
  nextCursor: string | null;
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
} as const;

export interface ServiceAddressFilters {
  customerId?: string;
}

export async function listServiceAddresses(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters?: ServiceAddressFilters },
): Promise<ServiceAddressListPage> {
  // Keyset pagination on (created_at desc, id desc). Explicit `tenant_id`
  // predicate is defense in depth (matches RLS) and gives the planner a
  // literal for `service_addresses_tenant_customer_idx`.
  return withTenantContext(db, tenantId, async (tx) => {
    const { customerId } = opts.filters ?? {};

    const cursorPredicate = opts.cursor
      ? or(
          lt(serviceAddresses.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(serviceAddresses.createdAt, new Date(opts.cursor.createdAt)),
            lt(serviceAddresses.id, opts.cursor.id),
          ),
        )
      : undefined;
    const where = and(
      eq(serviceAddresses.tenantId, tenantId),
      customerId !== undefined ? eq(serviceAddresses.customerId, customerId) : undefined,
      cursorPredicate,
    );

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
  serviceAddressId: string,
): Promise<ServiceAddressListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(serviceAddresses)
      .where(
        and(
          eq(serviceAddresses.tenantId, tenantId),
          eq(serviceAddresses.id, serviceAddressId),
        ),
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
): Promise<ServiceAddressListItem | null> {
  // FK checks bypass RLS, so verify customer ownership in-tx; null on miss.
  return withTenantContext(db, tenantId, async (tx) => {
    const existing = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, input.customerId)))
      .limit(1);
    if (!existing[0]) return null;

    const rows = await tx
      .insert(serviceAddresses)
      .values({ ...input, tenantId })
      .returning(COLUMNS);
    return rows[0]!;
  });
}

// customerId omitted: no re-parenting an address to another customer.
export type ServiceAddressUpdate = Partial<Omit<ServiceAddressCreate, "customerId">>;

export async function updateServiceAddress(
  db: Db,
  tenantId: string,
  id: string,
  input: ServiceAddressUpdate,
): Promise<ServiceAddressListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .update(serviceAddresses)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(serviceAddresses.tenantId, tenantId), eq(serviceAddresses.id, id)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteServiceAddress(db: Db, tenantId: string, id: string): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(serviceAddresses)
      .where(and(eq(serviceAddresses.tenantId, tenantId), eq(serviceAddresses.id, id)))
      .returning({ id: serviceAddresses.id });
    return rows.length > 0;
  });
}
