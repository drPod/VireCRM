import { and, asc, eq, gt, gte, isNotNull, lte, or } from "drizzle-orm";
import type { Db } from "../index";
import { contracts, customers, esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

export { decodeCursor };

// Renewal radar: active contracts ending inside [windowStart, windowEnd],
// joined to esi → address → customer, soonest end date first.
export interface RenewalRow {
  contractId: string;
  supplier: string | null;
  supplyType: string | null;
  startDate: string | null;
  endDate: string;
  costPerKwh: string | null;
  agentMils: string | null;
  currency: string;
  annualUsageKwh: string | null;
  grossTcv: string | null;
  netTcv: string | null;
  isLive: boolean;
  esiRowId: string;
  esiId: string;
  serviceAddressId: string;
  streetNo: string | null;
  streetName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  customerId: string;
  customerName: string;
}

export interface RenewalPage {
  items: RenewalRow[];
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
  serviceAddressId: serviceAddresses.id,
  streetNo: serviceAddresses.streetNo,
  streetName: serviceAddresses.streetName,
  addressLine1: serviceAddresses.addressLine1,
  city: serviceAddresses.city,
  state: serviceAddresses.state,
  zip: serviceAddresses.zip,
  customerId: customers.id,
  customerName: customers.name,
} as const;

export interface ListRenewalsOpts {
  limit: number;
  cursor: Cursor | null;
  windowStart: string;
  windowEnd: string;
  customerId?: string;
}

export async function listRenewals(
  db: Db,
  tenantId: string,
  opts: ListRenewalsOpts,
): Promise<RenewalPage> {
  return withTenantContext(db, tenantId, async (tx) => {
    // Ascending keyset on (end_date, id); the shared cursor's createdAt field carries end_date.
    const cursorPredicate = opts.cursor
      ? or(
          gt(contracts.endDate, opts.cursor.createdAt),
          and(eq(contracts.endDate, opts.cursor.createdAt), gt(contracts.id, opts.cursor.id)),
        )
      : undefined;

    const where = and(
      eq(contracts.tenantId, tenantId),
      eq(contracts.pipelineStatus, "active"),
      isNotNull(contracts.endDate),
      gte(contracts.endDate, opts.windowStart),
      lte(contracts.endDate, opts.windowEnd),
      opts.customerId !== undefined ? eq(serviceAddresses.customerId, opts.customerId) : undefined,
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
        and(eq(customers.id, serviceAddresses.customerId), eq(customers.tenantId, tenantId)),
      )
      .where(where)
      .orderBy(asc(contracts.endDate), asc(contracts.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const raw = hasMore ? rows.slice(0, opts.limit) : rows;
    // isNotNull(endDate) in WHERE guarantees non-null; narrow the type.
    const items = raw.map((r) => ({ ...r, endDate: r.endDate! }));
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ createdAt: last.endDate, id: last.contractId }) : null;

    return { items, nextCursor };
  });
}
