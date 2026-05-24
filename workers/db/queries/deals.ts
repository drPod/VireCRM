import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Db } from "../index";
import { deals } from "../schema";
import { withTenantContext } from "../with-tenant-context";
import { type Cursor, decodeCursor, encodeCursor } from "./_cursor";

// Re-exported so the route layer keeps its single import surface.
export { decodeCursor };

export interface DealListItem {
  id: string;
  customerId: string;
  primaryAgentId: string | null;
  secondaryAgentId: string | null;
  contractId: string | null;
  name: string | null;
  externalSaleId: string | null;
  saleDate: string | null;
  stage: string;
  saleStatus: string | null;
  objectionStatus: string | null;
  objectionType: string | null;
  sourceOfLead: string | null;
  createdAt: Date;
}

export interface DealListPage {
  items: DealListItem[];
  nextCursor: string | null;
}

const COLUMNS = {
  id: deals.id,
  customerId: deals.customerId,
  primaryAgentId: deals.primaryAgentId,
  secondaryAgentId: deals.secondaryAgentId,
  contractId: deals.contractId,
  name: deals.name,
  externalSaleId: deals.externalSaleId,
  saleDate: deals.saleDate,
  stage: deals.stage,
  saleStatus: deals.saleStatus,
  objectionStatus: deals.objectionStatus,
  objectionType: deals.objectionType,
  sourceOfLead: deals.sourceOfLead,
  createdAt: deals.createdAt,
} as const;

export interface DealFilters {
  customerId?: string;
  primaryAgentId?: string;
  secondaryAgentId?: string;
  stage?: string;
  saleStatus?: string;
}

export async function listDeals(
  db: Db,
  tenantId: string,
  opts: { limit: number; cursor: Cursor | null; filters: DealFilters },
): Promise<DealListPage> {
  // Composite tiebreak: (created_at desc, id desc). Backed by
  // `deals_tenant_created_idx (tenant_id, created_at desc, id desc)`.
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // and lets the planner use the composite index with a literal rather than
  // the `auth.jwt()->>tenant_id` function call from RLS.
  return withTenantContext(db, tenantId, async (tx) => {
    const { cursor, filters } = opts;
    const cursorAt = cursor ? new Date(cursor.createdAt) : null;
    const where = and(
      eq(deals.tenantId, tenantId),
      filters.customerId ? eq(deals.customerId, filters.customerId) : undefined,
      filters.primaryAgentId ? eq(deals.primaryAgentId, filters.primaryAgentId) : undefined,
      filters.secondaryAgentId ? eq(deals.secondaryAgentId, filters.secondaryAgentId) : undefined,
      filters.stage ? eq(deals.stage, filters.stage) : undefined,
      filters.saleStatus ? eq(deals.saleStatus, filters.saleStatus) : undefined,
      cursor && cursorAt
        ? or(
            lt(deals.createdAt, cursorAt),
            and(eq(deals.createdAt, cursorAt), lt(deals.id, cursor.id)),
          )
        : undefined,
    );

    const rows = await tx
      .select(COLUMNS)
      .from(deals)
      .where(where)
      .orderBy(desc(deals.createdAt), desc(deals.id))
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

export async function getDealById(
  db: Db,
  tenantId: string,
  dealId: string,
): Promise<DealListItem | null> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .select(COLUMNS)
      .from(deals)
      .where(and(eq(deals.tenantId, tenantId), eq(deals.id, dealId)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export interface DealInsert {
  customerId: string;
  primaryAgentId: string;
  secondaryAgentId?: string | null;
  contractId?: string | null;
  name?: string | null;
  externalSaleId?: string | null;
  saleDate?: string | null;
  stage?: string;
  saleStatus?: string | null;
  objectionStatus?: string | null;
  objectionType?: string | null;
  sourceOfLead?: string | null;
}

export async function createDeal(
  db: Db,
  tenantId: string,
  input: DealInsert,
): Promise<DealListItem> {
  // Force tenantId from handler arg — never trust caller-supplied tenant.
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .insert(deals)
      .values({ ...input, tenantId })
      .returning(COLUMNS);
    return rows[0]!;
  });
}

export type DealUpdate = Partial<DealInsert>;

export async function updateDeal(
  db: Db,
  tenantId: string,
  dealId: string,
  patch: DealUpdate,
): Promise<DealListItem | null> {
  // Empty patches are rejected at the API boundary (route Zod refine), so
  // `set()` always writes at least one column besides `updatedAt`.
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .update(deals)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(deals.tenantId, tenantId), eq(deals.id, dealId)))
      .returning(COLUMNS);
    return rows[0] ?? null;
  });
}

export async function deleteDeal(
  db: Db,
  tenantId: string,
  dealId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async (tx) => {
    const rows = await tx
      .delete(deals)
      .where(and(eq(deals.tenantId, tenantId), eq(deals.id, dealId)))
      .returning({ id: deals.id });
    return rows.length > 0;
  });
}
