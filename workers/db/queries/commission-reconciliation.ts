import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "../index";
import { commissionStatements, contracts, customers, esis, serviceAddresses } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

export { decodeCursor };

// Per-contract reconciliation rollup: statements aggregated against the
// contract's EAC. Commission is paid on Billing AQ, not EAC — the variance
// is the #1 dispute source.
export interface ReconciliationRow {
  contractId: string;
  customerId: string;
  customerName: string;
  esiId: string;
  supplier: string | null;
  agentMils: string | null;
  currency: string;
  eacKwh: string | null;
  statementCount: number;
  billedAqKwh: string | null;
  expectedTotal: string | null;
  receivedTotal: string | null;
  outstandingTotal: string | null;
  matchedCount: number;
  shortCount: number;
  overCount: number;
  pendingCount: number;
  unknownCount: number;
  createdAt: Date;
}

export interface ReconciliationPage {
  items: ReconciliationRow[];
  nextCursor: string | null;
}

export const RECON_STATUSES = ["matched", "short", "over", "pending", "unknown"] as const;
export type ReconStatus = (typeof RECON_STATUSES)[number];

const statusCount = (status: ReconStatus) =>
  sql<number>`(count(*) filter (where ${commissionStatements.reconciliationStatus} = ${status}))::int`;

const COLUMNS = {
  contractId: contracts.id,
  customerId: customers.id,
  customerName: customers.name,
  esiId: esis.esiId,
  supplier: contracts.supplier,
  agentMils: contracts.agentMils,
  currency: contracts.currency,
  eacKwh: contracts.annualUsageKwh,
  statementCount: sql<number>`count(${commissionStatements.id})::int`,
  billedAqKwh: sql<string | null>`sum(${commissionStatements.billingAqKwh})`,
  expectedTotal: sql<string | null>`sum(${commissionStatements.expectedAmount})`,
  receivedTotal: sql<string | null>`sum(${commissionStatements.receivedAmount})`,
  outstandingTotal: sql<string | null>`sum(${commissionStatements.outstandingAmount})`,
  matchedCount: statusCount("matched"),
  shortCount: statusCount("short"),
  overCount: statusCount("over"),
  pendingCount: statusCount("pending"),
  unknownCount: statusCount("unknown"),
  createdAt: contracts.createdAt,
} as const;

export interface ListReconciliationOpts {
  limit: number;
  cursor: Cursor | null;
  customerId?: string;
  status?: ReconStatus;
}

export async function listReconciliation(
  db: Db,
  tenantId: string,
  opts: ListReconciliationOpts,
): Promise<ReconciliationPage> {
  return withTenantContext(db, tenantId, async (tx) => {
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
      eq(commissionStatements.tenantId, tenantId),
      eq(contracts.tenantId, tenantId),
      opts.customerId !== undefined ? eq(serviceAddresses.customerId, opts.customerId) : undefined,
      cursorPredicate,
    );

    let query = tx
      .select(COLUMNS)
      .from(commissionStatements)
      .innerJoin(
        contracts,
        and(eq(contracts.id, commissionStatements.contractId), eq(contracts.tenantId, tenantId)),
      )
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
      .groupBy(contracts.id, esis.id, customers.id)
      .orderBy(desc(contracts.createdAt), desc(contracts.id))
      .limit(opts.limit + 1)
      .$dynamic();

    // `?status=short` → only contracts with at least one such statement.
    if (opts.status !== undefined) {
      query = query.having(
        sql`count(*) filter (where ${commissionStatements.reconciliationStatus} = ${opts.status}) > 0`,
      );
    }

    const rows = await query;
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
