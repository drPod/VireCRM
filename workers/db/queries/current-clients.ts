import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { contracts, customers, esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer keeps its single import surface.
export { decodeCursor };

// Denormalized read model for the "Current Clients" tab: every ACTIVE
// contract joined to its ESI, service address, and owning customer in one
// row, so the frontend renders the live book of business (README: "every
// active contract, organized by customer, with all ESIs, supplier terms,
// dates, and rates visible") without an N+1 walk over four endpoints.
//
// Read-only by design — mutations go through /api/contracts.
export interface CurrentClientRow {
  contractId: string;
  supplier: string | null;
  supplyType: string | null;
  startDate: string | null;
  endDate: string | null;
  costPerKwh: string | null;
  agentMils: string | null;
  currency: string;
  annualUsageKwh: string | null;
  grossTcv: string | null;
  netTcv: string | null;
  isLive: boolean;
  esiRowId: string;
  esiId: string;
  physicalMeterSerial: string | null;
  serviceAddressId: string;
  streetNo: string | null;
  streetName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  customerId: string;
  customerName: string;
  createdAt: Date;
}

export interface CurrentClientPage {
  items: CurrentClientRow[];
  nextCursor: string | null;
}

const COLUMNS = {
  contractId: contracts.id,
  supplier: contracts.supplier,
  supplyType: contracts.supplyType,
  startDate: contracts.startDate,
  endDate: contracts.endDate,
  costPerKwh: contracts.costPerKwh,
  agentMils: contracts.agentMils,
  currency: contracts.currency,
  annualUsageKwh: contracts.annualUsageKwh,
  grossTcv: contracts.grossTcv,
  netTcv: contracts.netTcv,
  isLive: contracts.isLive,
  esiRowId: esis.id,
  esiId: esis.esiId,
  physicalMeterSerial: esis.physicalMeterSerial,
  serviceAddressId: serviceAddresses.id,
  streetNo: serviceAddresses.streetNo,
  streetName: serviceAddresses.streetName,
  addressLine1: serviceAddresses.addressLine1,
  city: serviceAddresses.city,
  state: serviceAddresses.state,
  zip: serviceAddresses.zip,
  customerId: customers.id,
  customerName: customers.name,
  createdAt: contracts.createdAt,
} as const;

export interface CurrentClientFilters {
  customerId?: string;
}

export async function listCurrentClients(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters?: CurrentClientFilters },
): Promise<CurrentClientPage> {
  // Keyset pagination on the contracts side: (created_at desc, id desc).
  // Inner joins are all tenant-checked explicitly even though every join key
  // is a same-tenant FK and RLS already gates each table — defense in depth,
  // and the literal predicates keep the planner on the tenant-led indexes.
  return withTenantContext(db, tenantId, async (tx) => {
    const { customerId } = opts.filters ?? {};

    const cursorPredicate = opts.cursor
      ? or(
          lt(contracts.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(contracts.createdAt, new Date(opts.cursor.createdAt)),
            lt(contracts.id, opts.cursor.id),
          ),
        )
      : undefined;

    const where = and(
      eq(contracts.tenantId, tenantId),
      // "Current client" = customer with an active contract. Pipeline status
      // is the real Postgres enum ('pending'|'active'|'expired'|'lost');
      // `active` means signed, possibly future-dated — orthogonal to isLive.
      eq(contracts.pipelineStatus, "active"),
      customerId !== undefined ? eq(serviceAddresses.customerId, customerId) : undefined,
      cursorPredicate,
    );

    const rows = await tx
      .select(COLUMNS)
      .from(contracts)
      .innerJoin(esis, and(eq(esis.id, contracts.esiId), eq(esis.tenantId, tenantId)))
      .innerJoin(
        serviceAddresses,
        and(
          eq(serviceAddresses.id, esis.serviceAddressId),
          eq(serviceAddresses.tenantId, tenantId),
        ),
      )
      .innerJoin(
        customers,
        and(
          eq(customers.id, serviceAddresses.customerId),
          eq(customers.tenantId, tenantId),
        ),
      )
      .where(where)
      .orderBy(desc(contracts.createdAt), desc(contracts.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.contractId })
        : null;

    return { items, nextCursor };
  });
}
