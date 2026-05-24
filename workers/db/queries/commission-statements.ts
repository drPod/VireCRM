import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { commissionStatements } from "../schema";
import { withTenantContext } from "../with-tenant-context";

// `numeric` columns come back as strings from postgres-js (lossless decimal).
// Generated columns (`expectedAmount`, `reconciliationStatus`) are read-only —
// the DB computes them; we expose them on read, strip them on write.
export interface CommissionStatementRow {
  id: string;
  contractId: string;
  statementBatchId: string | null;
  supplier: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pdfStoragePath: string | null;
  billingAqKwh: string | null;
  mils: string | null;
  expectedAmount: string | null;
  receivedAmount: string | null;
  outstandingAmount: string | null;
  netOutstanding: string | null;
  agentCommsPaid: string | null;
  agentCommsOutstanding: string | null;
  reconciliationStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionStatementListPage {
  items: CommissionStatementRow[];
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
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

const COLUMNS = {
  id: commissionStatements.id,
  contractId: commissionStatements.contractId,
  statementBatchId: commissionStatements.statementBatchId,
  supplier: commissionStatements.supplier,
  periodStart: commissionStatements.periodStart,
  periodEnd: commissionStatements.periodEnd,
  pdfStoragePath: commissionStatements.pdfStoragePath,
  billingAqKwh: commissionStatements.billingAqKwh,
  mils: commissionStatements.mils,
  expectedAmount: commissionStatements.expectedAmount,
  receivedAmount: commissionStatements.receivedAmount,
  outstandingAmount: commissionStatements.outstandingAmount,
  netOutstanding: commissionStatements.netOutstanding,
  agentCommsPaid: commissionStatements.agentCommsPaid,
  agentCommsOutstanding: commissionStatements.agentCommsOutstanding,
  reconciliationStatus: commissionStatements.reconciliationStatus,
  createdAt: commissionStatements.createdAt,
  updatedAt: commissionStatements.updatedAt,
} as const;

export interface ListFilters {
  contractId?: string;
  supplier?: string;
  statementBatchId?: string;
}

export async function listCommissionStatements(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters: ListFilters },
): Promise<CommissionStatementListPage> {
  // Composite tiebreak: (created_at desc, id desc). Same pattern as customers.
  // Explicit tenant predicate is defense-in-depth and lets the planner use the
  // composite index leading with `tenant_id` against a literal value.
  return withTenantContext(db, tenantId, async (tx) => {
    const predicates = [eq(commissionStatements.tenantId, tenantId)];
    if (opts.filters.contractId) {
      predicates.push(eq(commissionStatements.contractId, opts.filters.contractId));
    }
    if (opts.filters.supplier) {
      predicates.push(eq(commissionStatements.supplier, opts.filters.supplier));
    }
    if (opts.filters.statementBatchId) {
      predicates.push(
        eq(commissionStatements.statementBatchId, opts.filters.statementBatchId),
      );
    }
    if (opts.cursor) {
      predicates.push(
        or(
          lt(commissionStatements.createdAt, new Date(opts.cursor.createdAt)),
          and(
            eq(commissionStatements.createdAt, new Date(opts.cursor.createdAt)),
            lt(commissionStatements.id, opts.cursor.id),
          ),
        )!,
      );
    }

    const rows = await tx
      .select(COLUMNS)
      .from(commissionStatements)
      .where(and(...predicates))
      .orderBy(desc(commissionStatements.createdAt), desc(commissionStatements.id))
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

export async function getCommissionStatementById(
  db: Db,
  tenantId: string,
  id: string,
): Promise<CommissionStatementRow | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(commissionStatements)
      .where(
        and(
          eq(commissionStatements.tenantId, tenantId),
          eq(commissionStatements.id, id),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

// CreateInput / UpdateInput exclude generated cols (`expectedAmount`,
// `reconciliationStatus`) — DB computes those, writing throws. `tenantId` is
// forced from the arg, never accepted from the body.
export interface CreateInput {
  contractId: string;
  statementBatchId?: string | null;
  supplier?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  pdfStoragePath?: string | null;
  billingAqKwh?: string | null;
  mils?: string | null;
  receivedAmount?: string | null;
  outstandingAmount?: string | null;
  netOutstanding?: string | null;
  agentCommsPaid?: string | null;
  agentCommsOutstanding?: string | null;
}

export async function createCommissionStatement(
  db: Db,
  tenantId: string,
  input: CreateInput,
): Promise<CommissionStatementRow> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(commissionStatements)
      .values({ ...input, tenantId })
      .returning(COLUMNS);
    return rows[0]!;
  });
}

export type UpdateInput = Partial<CreateInput>;

export async function updateCommissionStatement(
  db: Db,
  tenantId: string,
  id: string,
  input: UpdateInput,
): Promise<CommissionStatementRow | null> {
  // Empty patch = no-op. Mirrors deals.ts. Without this short-circuit we'd
  // still bump `updatedAt` (because the SET clause always carries it), which
  // pollutes the audit trail on what's semantically a read.
  const hasAnyField = Object.values(input).some((v) => v !== undefined);
  if (!hasAnyField) return getCommissionStatementById(db, tenantId, id);

  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .update(commissionStatements)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(commissionStatements.tenantId, tenantId),
          eq(commissionStatements.id, id),
        ),
      )
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteCommissionStatement(
  db: Db,
  tenantId: string,
  id: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(commissionStatements)
      .where(
        and(
          eq(commissionStatements.tenantId, tenantId),
          eq(commissionStatements.id, id),
        ),
      )
      .returning({ id: commissionStatements.id });
    return rows.length > 0;
  });
}
