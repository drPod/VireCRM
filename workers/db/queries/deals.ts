import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import type { Db } from "../index";
import { deals } from "../schema";
import { withTenantContext } from "../with-tenant-context";

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
  // Composite tiebreak: (created_at desc, id desc). Same shape as customers.
  // Explicit `tenant_id = ?` predicate is defense in depth against RLS gaps
  // and lets the planner use composite indexes leading with `tenant_id`.
  return withTenantContext(db, tenantId, async (tx) => {
    const conds: SQL[] = [eq(deals.tenantId, tenantId)];
    if (opts.filters.customerId) {
      conds.push(eq(deals.customerId, opts.filters.customerId));
    }
    if (opts.filters.primaryAgentId) {
      conds.push(eq(deals.primaryAgentId, opts.filters.primaryAgentId));
    }
    if (opts.filters.secondaryAgentId) {
      conds.push(eq(deals.secondaryAgentId, opts.filters.secondaryAgentId));
    }
    if (opts.filters.stage) {
      conds.push(eq(deals.stage, opts.filters.stage));
    }
    if (opts.filters.saleStatus) {
      conds.push(eq(deals.saleStatus, opts.filters.saleStatus));
    }
    if (opts.cursor) {
      const cursorAt = new Date(opts.cursor.createdAt);
      // `or(...)` is non-undefined whenever called with ≥1 arg; the SQL[]
      // array shape forces us to assert non-null here.
      conds.push(
        or(
          lt(deals.createdAt, cursorAt),
          and(eq(deals.createdAt, cursorAt), lt(deals.id, opts.cursor.id)),
        )!,
      );
    }

    const rows = await tx
      .select(COLUMNS)
      .from(deals)
      .where(and(...conds))
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
  // Drizzle's `set()` accepts undefined per-key and skips those columns — but
  // an entirely empty patch produces `UPDATE deals SET WHERE …`, which is a
  // syntax error. Short-circuit to a plain existence check in that case so
  // PATCH /:id with `{}` still returns 404-vs-200 correctly.
  const hasAnyField = Object.values(patch).some((v) => v !== undefined);
  if (!hasAnyField) return getDealById(db, tenantId, dealId);

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
