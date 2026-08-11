import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer keeps its single import surface.
export { decodeCursor };

// Read-only projection. Service addresses are created out-of-band (xlsx
// migration); exposed so customer detail views can show addresses and so the
// frontend can walk customer → addresses → ESIs when creating contracts.
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
