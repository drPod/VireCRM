import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer keeps its single import surface.
export { decodeCursor };

// Read-only projection. ESIs are created out-of-band (xlsx migration).
// Exposed because `POST /api/contracts` requires the ESI row's UUID (`esiId`
// FK) and the UI must render the canonical ESI ID text + physical meter
// serial on customer / contract views.
//
// NAMING: `id` is the row UUID (what `contracts.esiId` references);
// `esiId` is the canonical 17–22-digit ERCOT Electric Service Identifier.
export interface EsiListItem {
  id: string;
  serviceAddressId: string;
  esiId: string;
  physicalMeterSerial: string | null;
  eacKwh: string | null;
  billingAqKwh: string | null;
  annualUsageKwh: string | null;
  createdAt: Date;
}

export interface EsiListPage {
  items: EsiListItem[];
  nextCursor: string | null;
}

const COLUMNS = {
  id: esis.id,
  serviceAddressId: esis.serviceAddressId,
  esiId: esis.esiId,
  physicalMeterSerial: esis.physicalMeterSerial,
  eacKwh: esis.eacKwh,
  billingAqKwh: esis.billingAqKwh,
  annualUsageKwh: esis.annualUsageKwh,
  createdAt: esis.createdAt,
} as const;

export interface EsiFilters {
  serviceAddressId?: string;
  customerId?: string;
}

export async function listEsis(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters?: EsiFilters },
): Promise<EsiListPage> {
  // Keyset pagination on (created_at desc, id desc). The `customerId` filter
  // resolves through service_addresses (same pattern as the contracts query's
  // customer filter) so callers can list every meter a customer owns without
  // first walking addresses. Explicit `tenant_id` predicates are defense in
  // depth (matching RLS) on both the main query and the subquery.
  return withTenantContext(db, tenantId, async (tx) => {
    const { serviceAddressId, customerId } = opts.filters ?? {};

    const customerAddressSubquery =
      customerId !== undefined
        ? tx
            .select({ id: serviceAddresses.id })
            .from(serviceAddresses)
            .where(
              and(
                eq(serviceAddresses.tenantId, tenantId),
                eq(serviceAddresses.customerId, customerId),
              ),
            )
        : undefined;

    const cursorPredicate = opts.cursor
      ? or(
          lt(esis.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(esis.createdAt, new Date(opts.cursor.createdAt)),
            lt(esis.id, opts.cursor.id),
          ),
        )
      : undefined;
    const where = and(
      eq(esis.tenantId, tenantId),
      serviceAddressId !== undefined
        ? eq(esis.serviceAddressId, serviceAddressId)
        : undefined,
      customerAddressSubquery !== undefined
        ? inArray(esis.serviceAddressId, customerAddressSubquery)
        : undefined,
      cursorPredicate,
    );

    const rows = await tx
      .select(COLUMNS)
      .from(esis)
      .where(where)
      .orderBy(desc(esis.createdAt), desc(esis.id))
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

export async function getEsiById(
  db: Db,
  tenantId: string,
  esiRowId: string,
): Promise<EsiListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(esis)
      .where(and(eq(esis.tenantId, tenantId), eq(esis.id, esiRowId)))
      .limit(1);
    return rows[0] ?? null;
  });
}
